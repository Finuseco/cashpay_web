

'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { User, Group, GroupMember, LoanMePartner } from '@/lib/types';
import { generateReferenceCode, countryToCode } from '../utils';
import { sendEmail } from '@/services/email';

function generateGroupWalletId(groupId: number): string {
    const paddedId = groupId.toString().padStart(8, '0');
    return `GR${paddedId}`;
}

export async function registerLoanMePartner(userId: number, companyData: any): Promise<{ success: boolean; error?: string }> {
    try {
        const { companyName, rccm, nationalId, address } = companyData;
        
        const { rows: existing } = await db.query('SELECT id FROM loanme_partners WHERE user_id = $1 OR rccm = $2 OR national_id = $3', [userId, rccm, nationalId]);
        if (existing.length > 0) {
            return { success: false, error: "Un partenaire avec ces informations existe déjà." };
        }
        
        const payload = {
            user_id: userId,
            company_name: companyName,
            rccm: rccm,
            national_id: nationalId,
            address: address,
        };

        await db.query('INSERT INTO loanme_partners (user_id, company_name, rccm, national_id, address) VALUES ($1, $2, $3, $4, $5)', Object.values(payload));
        
        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'registering LoanMe partner');
        return { success: false, error: dbError.error };
    }
}


export async function getLoanMePartnerDetails(userId: number): Promise<LoanMePartner | null> {
    try {
        const { rows } = await db.query('SELECT * FROM loanme_partners WHERE user_id = $1', [userId]);
        if (rows.length === 0) {
            return null;
        }
        const partner = rows[0];
        
        const { rows: groups } = await db.query(`
            SELECT lg.*, COUNT(lgm.id) as member_count
            FROM loanme_groups lg
            LEFT JOIN loanme_group_members lgm ON lg.id = lgm.group_id
            WHERE lg.partner_id = $1
            GROUP BY lg.id
        `, [partner.id]);
        
        const { rows: commissions } = await db.query('SELECT * FROM loanme_partner_commissions WHERE partner_id = $1', [partner.id]);

        return {
            ...partner,
            groups,
            commissions
        };
    } catch (error) {
        handleDbError(error, 'fetching LoanMe partner details');
        return null;
    }
}


export async function createLoanMeGroup(partnerId: number, groupName: string): Promise<{ success: boolean; group?: any; error?: string }> {
    try {
        const { rows } = await db.query('INSERT INTO loanme_groups (partner_id, group_name) VALUES ($1, $2) RETURNING *', [partnerId, groupName]);
        return { success: true, group: rows[0] };
    } catch (error) {
        const dbError = await handleDbError(error, 'creating LoanMe group');
        return { success: false, error: dbError.error };
    }
}

export async function addMemberToGroup(groupId: number, userWalletId: string): Promise<{ success: boolean; member?: any; error?: string }> {
     const connection = await db.getConnection();
     try {
        await connection.query('BEGIN');
        
        const { rows: userRows } = await connection.query('SELECT id, full_name, first_name, email FROM users WHERE id_wallet = $1', [userWalletId]);
        if (userRows.length === 0) {
            throw new Error("Utilisateur non trouvé.");
        }
        const user = userRows[0];
        
        const { rows: existingMemberRows } = await connection.query('SELECT group_id FROM loanme_group_members WHERE user_id = $1', [user.id]);
        if (existingMemberRows.length > 0) {
            throw new Error("Cet utilisateur est déjà membre d'un groupe LoanMe.");
        }

        const { rows: memberRows } = await connection.query('INSERT INTO loanme_group_members (group_id, user_id) VALUES ($1, $2) RETURNING *', [groupId, user.id]);
        
        const { rows: groupRows } = await connection.query('SELECT lg.group_name, p.company_name FROM loanme_groups lg JOIN loanme_partners p ON lg.partner_id = p.id WHERE lg.id = $1', [groupId]);
        const groupInfo = groupRows[0];

        await connection.query('COMMIT');
        
        if (user.email) {
            sendEmail(user.email, `Bienvenue dans le groupe ${groupInfo.group_name}`, 'loanme_member_added', {
                partnerName: groupInfo.company_name,
                groupName: groupInfo.group_name,
                memberName: user.first_name,
                memberWalletId: userWalletId,
                dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/mlm/loanme`
            }).catch(console.error);
        }

        return { success: true, member: { ...memberRows[0], full_name: user.full_name } };
     } catch (error: any) {
        await connection.query('ROLLBACK');
        if (error.code === '23505') { // unique_violation
            return { success: false, error: "Cet utilisateur est déjà dans ce groupe." };
        }
        const dbError = await handleDbError(error, 'adding member to group');
        return { success: false, error: dbError.error || error.message };
     } finally {
        connection.release();
     }
}

export async function getGroupMembers(groupId: number): Promise<any[]> {
    try {
        const { rows } = await db.query(`
            SELECT lgm.*, u.full_name, u.id_wallet
            FROM loanme_group_members lgm
            JOIN users u ON lgm.user_id = u.id
            WHERE lgm.group_id = $1
        `, [groupId]);
        return rows;
    } catch (error) {
        handleDbError(error, 'fetching group members');
        return [];
    }
}

export async function getGroupMembershipForUser(userId: number): Promise<{ group: any, partner: any } | null> {
    try {
        const { rows } = await db.query(`
            SELECT 
                g.id as group_id, g.group_name,
                p.id as partner_id, p.company_name as partner_name,
                u.full_name as partner_contact_name, u.profile_photo as partner_photo
            FROM loanme_group_members gm
            JOIN loanme_groups g ON gm.group_id = g.id
            JOIN loanme_partners p ON g.partner_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE gm.user_id = $1
        `, [userId]);

        if (rows.length === 0) {
            return null;
        }
        const data = rows[0];
        return {
            group: { id: data.group_id, name: data.group_name },
            partner: { id: data.partner_id, name: data.partner_name, contactName: data.partner_contact_name, photo: data.partner_photo }
        };
    } catch (error) {
        handleDbError(error, 'fetching user group membership');
        return null;
    }
}
    
