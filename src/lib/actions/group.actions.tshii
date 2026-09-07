
'use server';

import { db } from '@/lib/db';
import { handleDbError, getUserFromDb } from './helpers';
import type { User, Group, GroupMember, GroupTransaction, GroupMemberInfo, GroupMessage } from '@/lib/types';
import { verifyCurrentUserPin } from './auth.actions';
import { calculateTransactionFee } from './wallet.actions';
import { createTransaction } from './transaction.actions';
import { sendEmail } from '@/services/email';
import { processMaxiCashPayout } from '@/services/maxicash';
import { countryToCode, formatUser } from '../utils';
import type { PoolClient } from 'pg';

function generateGroupWalletId(groupId: number): string {
    const paddedId = groupId.toString().padStart(8, '0');
    return `GR${paddedId}`;
}

export async function createGroup(
    owner: User,
    name: string,
    currency: 'USD' | 'EUR' | 'CDF',
    description?: string,
    photoUrl?: string
): Promise<{ success: boolean; group?: Group; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Create the group entry to get an ID
        const groupData = {
            name,
            description,
            photo_url: photoUrl,
            currency,
            owner_user_id: owner.id,
        };
        const { rows: groupResult } = await connection.query(
            'INSERT INTO groups (name, description, photo_url, currency, owner_user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [groupData.name, groupData.description, groupData.photo_url, groupData.currency, groupData.owner_user_id]
        );
        const groupId = groupResult[0].id;

        // 2. Generate the unique Group Wallet ID
        const groupWalletId = generateGroupWalletId(groupId);
        
        // 3. Create the corresponding wallet in the wallets table FIRST
        const walletData = {
            id_wallet: groupWalletId,
            balances: JSON.stringify({ [currency]: 0 }),
            is_group_wallet: true
        };
        await connection.query('INSERT INTO wallets (id_wallet, balances, is_group_wallet) VALUES ($1, $2, $3)', [walletData.id_wallet, walletData.balances, walletData.is_group_wallet]);
        
        // 4. NOW, assign the Group Wallet ID to the group
        await connection.query('UPDATE groups SET group_wallet_id = $1 WHERE id = $2', [groupWalletId, groupId]);

        // 5. Add the owner as the first admin member
        const memberData = {
            group_id: groupId,
            user_id: owner.id,
            role: 'admin',
            status: 'active'
        };
        await connection.query('INSERT INTO group_members (group_id, user_id, role, status) VALUES ($1, $2, $3, $4)', [memberData.group_id, memberData.user_id, memberData.role, memberData.status]);

        await connection.query('COMMIT');
        
        const newGroup: Group = {
            id: groupId,
            name,
            description,
            photo_url: photoUrl,
            currency,
            group_wallet_id: groupWalletId,
            owner_user_id: owner.id,
            created_at: new Date().toISOString(),
            member_count: 1,
            balance: 0,
            members: [],
            messages: [],
        };

        return { success: true, group: newGroup };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'creating group');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}


export async function getUserGroups(userId: number): Promise<Group[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                g.id, g.name, g.description, g.photo_url, g.currency, g.group_wallet_id, g.owner_user_id, g.created_at,
                (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.status = 'active') as member_count,
                (w.balances->>g.currency)::numeric as balance
            FROM groups g
            JOIN group_members gm ON g.id = gm.group_id
            LEFT JOIN wallets w ON g.group_wallet_id = w.id_wallet
            WHERE gm.user_id = $1 AND gm.status = 'active'
            ORDER BY g.created_at DESC
        `, [userId]);

        return rows.map(row => ({
            ...row,
            id: Number(row.id),
            owner_user_id: Number(row.owner_user_id),
            balance: parseFloat(row.balance || '0'),
            member_count: Number(row.member_count),
            created_at: new Date(row.created_at).toISOString(),
            members: [],
            messages: [],
        })) as Group[];

    } catch (error) {
        handleDbError(error, 'fetching user groups');
        return [];
    }
}

export async function getGroupById(groupId: number, userId: number): Promise<Group | null> {
    try {
        const { rows: groupRows } = await db.query(`
             SELECT 
                g.id, g.name, g.description, g.photo_url, g.currency, g.group_wallet_id, g.owner_user_id, g.created_at,
                (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.status = 'active') as member_count,
                (w.balances->>g.currency)::numeric as balance,
                (SELECT role FROM group_members WHERE group_id = g.id AND user_id = $2) as user_role
            FROM groups g
            LEFT JOIN wallets w ON g.group_wallet_id = w.id_wallet
            WHERE g.id = $1 AND EXISTS (SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = $2 AND status = 'active')
        `, [groupId, userId]);

        if (groupRows.length === 0) {
            return null; // Not found or user is not a member
        }
        
        const groupData = groupRows[0];

        const { rows: memberRows } = await db.query(`
            SELECT u.id, u.full_name, u.profile_photo, gm.role FROM users u
            JOIN group_members gm ON u.id = gm.user_id
            WHERE gm.group_id = $1 AND gm.status = 'active'
        `, [groupId]);

        return {
            ...groupData,
            id: Number(groupData.id),
            owner_user_id: Number(groupData.owner_user_id),
            balance: parseFloat(groupData.balance || '0'),
            member_count: Number(groupData.member_count),
            created_at: new Date(groupData.created_at).toISOString(),
            members: memberRows,
            messages: [], // messages will be fetched in getGroupWithMessages
            user_role: groupData.user_role
        };

    } catch (error) {
        handleDbError(error, 'fetching group by ID');
        return null;
    }
}

export async function getGroupWithMessages(groupId: number, userId: number): Promise<Group | null> {
    const group = await getGroupById(groupId, userId);
    if (!group) return null;

    try {
        const { rows: messageRows } = await db.query(`
            SELECT * FROM group_messages WHERE group_id = $1 ORDER BY created_at ASC
        `, [groupId]);

        group.messages = messageRows.map(m => ({
            id: m.id.toString(),
            senderId: m.sender_id,
            content: m.content,
            timestamp: new Date(m.created_at).toISOString(),
            type: m.type,
            status: 'sent',
            groupId: m.group_id,
        }));
    } catch(e) {
        console.error("Failed to fetch group messages", e);
        group.messages = [];
    }

    return group;
}


export async function addMemberToGroup(groupId: number, currentUserId: number, newMemberWalletId: string): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        
        const { rows: adminCheck } = await connection.query("SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = 'active'", [groupId, currentUserId]);
        if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
            throw new Error("Vous n'avez pas la permission d'ajouter des membres à ce groupe.");
        }
        
        const userToAdd = await getUserFromDb({ walletId: newMemberWalletId });
        if (!userToAdd) {
            throw new Error("L'utilisateur avec cet ID de portefeuille n'a pas été trouvé.");
        }
        const newMemberUserId = userToAdd.id;

        const { rows: existingMember } = await connection.query('SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, newMemberUserId]);
        if (existingMember.length > 0) {
            throw new Error("Cet utilisateur est déjà membre du groupe.");
        }
        
        await connection.query("INSERT INTO group_members (group_id, user_id, role, status) VALUES ($1, $2, 'member', 'active')", [groupId, newMemberUserId]);
        
        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'adding member to group');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}

export async function removeMemberFromGroup(groupId: number, currentUserId: number, memberToRemoveId: number): Promise<{ success: boolean; error?: string }> {
    try {
        const { rows: adminCheck } = await db.query("SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = 'active'", [groupId, currentUserId]);
        if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
            return { success: false, error: "Vous n'avez pas la permission de supprimer des membres de ce groupe." };
        }
        
        await db.query("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2", [groupId, memberToRemoveId]);
        
        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'removing member from group');
        return { success: false, error: dbError.error };
    }
}

export async function getGroupMembers(groupId: number): Promise<GroupMemberInfo[]> {
    try {
        const { rows } = await db.query(`
            SELECT u.id, u.full_name, u.profile_photo, gm.role 
            FROM users u
            JOIN group_members gm ON u.id = gm.user_id
            WHERE gm.group_id = $1 AND gm.status = 'active'
            ORDER BY gm.role, u.full_name
        `, [groupId]);
        return rows as GroupMemberInfo[];
    } catch (error) {
        handleDbError(error, 'fetching group members');
        return [];
    }
}

export async function getGroupTransactions(groupId: number): Promise<GroupTransaction[]> {
    try {
        const { rows } = await db.query(
            `SELECT gt.*, u.full_name as user_name FROM group_transactions gt JOIN users u ON gt.user_id = u.id WHERE group_id = $1 ORDER BY created_at DESC LIMIT 100`,
            [groupId]
        );
        return rows.map(row => ({
            ...row,
            amount: parseFloat(row.amount)
        })) as GroupTransaction[];
    } catch (error) {
        handleDbError(error, 'fetching group transactions');
        return [];
    }
}

export async function contributeToGroup(args: {
    userId: number;
    groupId: number;
    amount: number;
    currency: string;
    pin: string;
}): Promise<{ success: boolean; error?: string; }> {
    const { userId, groupId, amount, currency, pin } = args;

    const pinVerification = await verifyCurrentUserPin(pin);
    if (!pinVerification.success) {
        return { success: false, error: pinVerification.error };
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0) throw new Error("Utilisateur introuvable.");

        const { rows: groupRows } = await connection.query('SELECT name, group_wallet_id FROM groups WHERE id = $1', [groupId]);
        if (groupRows.length === 0) throw new Error("Groupe introuvable.");
        
        const transactionResult = await createTransaction({
            user: userRows[0] as User,
            typeCode: 'GROUP_CONTRIBUTION',
            amount: amount,
            currency: currency,
            description: `Contribution au groupe ${groupRows[0].name}`,
            receiver_wallet_id: groupRows[0].group_wallet_id,
            metadata: { groupId },
            connection,
        });
        
        if (!transactionResult.success || !transactionResult.transactionId) {
            throw new Error(transactionResult.error);
        }

        const txData = {
            group_id: groupId,
            user_id: userId,
            type: 'contribution',
            amount, currency,
            description: `Contribution de ${userRows[0].full_name}`,
            source_transaction_id: transactionResult.transactionId,
        };
        await connection.query('INSERT INTO group_transactions (group_id, user_id, type, amount, currency, description, source_transaction_id) VALUES ($1, $2, $3, $4, $5, $6, $7)', Object.values(txData));
        
        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'contributing to group');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}


export async function payoutFromGroup(args: {
    adminUserId: number;
    groupId: number;
    amount: number;
    pin: string;
    destinationWalletId?: string;
    destinationMobile?: { phone: string; operator: string };
    description: string;
}): Promise<{ success: boolean; error?: string; }> {
    const { adminUserId, groupId, amount, pin, destinationWalletId, destinationMobile, description } = args;

    const pinVerification = await verifyCurrentUserPin(pin);
    if (!pinVerification.success) {
        return { success: false, error: pinVerification.error };
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: adminCheck } = await connection.query("SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = 'active'", [groupId, adminUserId]);
        if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
            throw new Error("Action non autorisée. Seul un admin peut effectuer un paiement.");
        }
        
        const { rows: groupRows } = await connection.query('SELECT group_wallet_id, name, currency FROM groups WHERE id = $1', [groupId]);
        if (groupRows.length === 0) throw new Error("Groupe introuvable.");
        const groupWalletId = groupRows[0].group_wallet_id;
        const groupCurrency = groupRows[0].currency;

        const { rows: groupBalanceRows } = await connection.query('SELECT balances FROM wallets WHERE id_wallet = $1 FOR UPDATE', [groupWalletId]);
        if (groupBalanceRows.length === 0) throw new Error("Portefeuille du groupe introuvable.");
        
        const groupBalances = groupBalanceRows[0].balances;
        if ((groupBalances[groupCurrency] || 0) < amount) {
            throw new Error(`Solde du portefeuille de groupe insuffisant.`);
        }

        // --- Logic de Décaissement ---
        if (destinationWalletId) {
            // Paiement interne CashPay
            const { rows: recipientUserRows } = await connection.query('SELECT id FROM users WHERE id_wallet = $1', [destinationWalletId]);
            if (recipientUserRows.length === 0) throw new Error("Destinataire introuvable.");
            const recipientUserId = recipientUserRows[0].id;

            groupBalances[groupCurrency] -= amount;
            await connection.query('UPDATE wallets SET balances = $1 WHERE id_wallet = $2', [JSON.stringify(groupBalances), groupWalletId]);

            await connection.query(`
                UPDATE wallets SET balances = jsonb_set(
                    COALESCE(balances, '{}'::jsonb), '{${groupCurrency}}', (COALESCE((balances->>'${groupCurrency}')::numeric, 0) + $1)::text::jsonb) 
                WHERE user_id = $2`, [amount, recipientUserId]);
        } else if (destinationMobile) {
            // Payout vers Mobile Money via MaxiCash
            const { rows: adminUserRows } = await connection.query('SELECT * FROM users WHERE id = $1', [adminUserId]);
            const adminUser = formatUser(adminUserRows[0]);
            
            const payoutResult = await processMaxiCashPayout({
                amount,
                currency: groupCurrency,
                recipientPhone: destinationMobile.phone,
                operator: destinationMobile.operator,
                countryCode: countryToCode(adminUser.country) || 'CD',
                reference: `GRP_PAY_${Date.now()}`,
                beneficiaryName: description || 'Paiement de Groupe',
                user: adminUser
            });

            if (!payoutResult.success) throw new Error(payoutResult.message || "Échec du virement Mobile Money.");
            
            // Débiter le groupe
            groupBalances[groupCurrency] -= amount;
            await connection.query('UPDATE wallets SET balances = $1 WHERE id_wallet = $2', [JSON.stringify(groupBalances), groupWalletId]);
        } else {
            throw new Error("Aucune destination de paiement fournie.");
        }
        
        const txData = {
            group_id: groupId,
            user_id: adminUserId,
            type: 'payout',
            amount, currency: groupCurrency,
            description: description,
            destination: destinationWalletId || destinationMobile?.phone,
        };
        await connection.query('INSERT INTO group_transactions (group_id, user_id, type, amount, currency, description, destination) VALUES ($1, $2, $3, $4, $5, $6, $7)', Object.values(txData));
        
        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}
