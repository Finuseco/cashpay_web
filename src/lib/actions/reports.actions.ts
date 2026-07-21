

'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';

export interface DailySales {
    date: string;
    revenue: number;
    profit: number;
}

export interface TopProduct {
    id: string;
    name: string;
    image: string;
    quantity: number;
    revenue: number;
}

export interface WorkerSales {
    id: number;
    name: string;
    sales: number;
}

export interface LossRecord {
    id: number;
    productName: string;
    lossValue: number;
}

export interface AgentReportData {
    summary: {
        totalRevenue: number;
        grossProfit: number;
        stockCapital: number;
        totalCommissions: { USD: number; EUR: number; LOCAL: number; };
    };
    salesByDay: DailySales[];
    topProducts: TopProduct[];
    salesByWorker: WorkerSales[];
    losses: LossRecord[];
}


export async function getAgentReportData(agentId: number, startDate?: Date, endDate?: Date, localCurrencyCode?: string): Promise<AgentReportData | null> {
    const connection = await db.getConnection();
    try {
        const dateConditions: string[] = [];
        const queryParams: (string | number | Date)[] = [agentId];
        const queryParamsWithoutAgentId: (string | number | Date)[] = [];


        if (startDate) {
            dateConditions.push("t.created_at >= $"+(queryParams.length+1));
            queryParams.push(startDate);
            queryParamsWithoutAgentId.push(startDate);
        }
        if (endDate) {
            dateConditions.push("t.created_at <= $"+(queryParams.length+1));
            queryParams.push(endDate);
            queryParamsWithoutAgentId.push(endDate);
        }
        const dateFilter = dateConditions.length > 0 ? `AND ${dateConditions.join(' AND ')}` : '';
        const dateFilterForLosses = dateConditions.length > 0 ? `AND created_at >= $1 AND created_at <= $2` : '';


        const { rows: salesSummaryRows } = await connection.query(`
            SELECT
                SUM(t.amount) AS totalRevenue,
                SUM(CAST(t.metadata->>'grossProfit' AS NUMERIC)) AS grossProfit
            FROM transactions t
            WHERE t.receiver_id = $1 AND t.type_code = 'POS_SALE' ${dateFilter}
        `, queryParams);
        const salesSummary = salesSummaryRows;

        const { rows: stockCapitalRows } = await connection.query(`
            SELECT SUM(purchase_price * stock) as totalCapital
            FROM products WHERE agent_id = $1
        `, [agentId]);
        const stockCapital = stockCapitalRows;
        
        const { rows: commissionsRows } = await connection.query(`
             SELECT 
                t.currency,
                SUM(CAST(t.metadata->>'agent_commission' AS NUMERIC)) as totalCommissions
             FROM transactions t
             WHERE CAST(t.metadata->>'agent_id' AS INTEGER) = $1 ${dateFilter}
             GROUP BY t.currency
        `, queryParams);
        const commissions = commissionsRows;

        // This table doesn't exist yet, commenting out to prevent errors
        // const { rows: lossesRows } = await connection.query(`
        //     SELECT id, product_name as productName, loss_value as lossValue FROM product_losses
        //     WHERE agent_id = $1 ${dateFilterForLosses}
        // `, [agentId, ...queryParamsWithoutAgentId]);


        const { rows: salesByDayRows } = await connection.query(`
            SELECT
                TO_CHAR(t.created_at, 'YYYY-MM-DD') as date,
                SUM(t.amount) AS revenue,
                SUM(CAST(t.metadata->>'grossProfit' AS NUMERIC)) AS profit
            FROM transactions t
            WHERE t.receiver_id = $1 AND t.type_code = 'POS_SALE' ${dateFilter}
            GROUP BY date
            ORDER BY date ASC
        `, queryParams);
        const salesByDay = salesByDayRows;

        const { rows: transactionsWithItemsRows } = await connection.query(`
            SELECT t.metadata FROM transactions t
            WHERE t.receiver_id = $1 AND t.type_code = 'POS_SALE' ${dateFilter}
        `, queryParams);
        const transactionsWithItems = transactionsWithItemsRows;

        const productSales: Record<string, { quantity: number; revenue: number }> = {};
        for (const trans of transactionsWithItems) {
            try {
                const metadata = trans.metadata; // Already an object
                if (metadata.items && Array.isArray(metadata.items)) {
                    for (const item of metadata.items) {
                        if (item.id) {
                            if (!productSales[item.id]) {
                                productSales[item.id] = { quantity: 0, revenue: 0 };
                            }
                            productSales[item.id].quantity += item.qty || item.quantity; // Support both qty and quantity
                            productSales[item.id].revenue += (item.price || item.sellingPrice) * (item.qty || item.quantity);
                        }
                    }
                }
            } catch(e) { console.error("Error parsing metadata for top products:", e); }
        }
        
        let topProducts: TopProduct[] = [];
        if(Object.keys(productSales).length > 0) {
            const productIds = Object.keys(productSales).map(Number);
            const { rows: productDetailsRows } = await connection.query(`
                SELECT id, name, (images->>0) as image
                FROM products WHERE id = ANY($1::int[])
            `, [productIds]);
            const productDetails = productDetailsRows;

            topProducts = productDetails.map(p => ({
                id: p.id.toString(),
                name: p.name,
                image: p.image || 'https://placehold.co/40x40.png',
                quantity: productSales[p.id.toString()]?.quantity || 0,
                revenue: productSales[p.id.toString()]?.revenue || 0,
            })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
        }

        const { rows: salesByWorkerRows } = await connection.query(`
            SELECT
                u.id,
                u.full_name as name,
                SUM(t.amount) as sales
            FROM transactions t
            JOIN users u ON CAST(t.metadata->'sellerInfo'->>'id' AS INTEGER) = u.id
            WHERE (t.type_code = 'POS_SALE' OR t.type_code = 'SALE')
            AND t.receiver_id = $1 ${dateFilter}
            GROUP BY u.id, u.full_name
            ORDER BY sales DESC
        `, queryParams);
        const salesByWorker = salesByWorkerRows;
        
        const totalCommissions = commissions.reduce((acc, row) => {
            if (row.currency === 'USD') acc.USD += Number(row.totalcommissions);
            else if (row.currency === 'EUR') acc.EUR += Number(row.totalcommissions);
            else if (row.currency === localCurrencyCode) acc.LOCAL += Number(row.totalcommissions);
            return acc;
        }, { USD: 0, EUR: 0, LOCAL: 0 });

        return {
            summary: {
                totalRevenue: Number(salesSummary[0]?.totalrevenue || 0),
                grossProfit: Number(salesSummary[0]?.grossprofit || 0),
                stockCapital: Number(stockCapital[0]?.totalcapital || 0),
                totalCommissions: totalCommissions,
            },
            salesByDay: salesByDay.map(row => ({ date: row.date, revenue: Number(row.revenue), profit: Number(row.profit) })),
            topProducts: topProducts,
            salesByWorker: salesByWorker.map(row => ({ id: row.id, name: row.name, sales: Number(row.sales) })),
            losses: [], //losses.map(row => ({ id: row.id, productName: row.productName, lossValue: Number(row.lossValue) })),
        };

    } catch (error) {
        handleDbError(error, 'fetching agent report data');
        return null;
    } finally {
        connection.release();
    }
}
