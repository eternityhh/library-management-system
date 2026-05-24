const prisma = require("../db/prisma");
const { formatDateTime } = require("../utils/date");
const { AppError } = require("../lib/errors");

function parsePagination(query) {
    const page = Number(query.page || 1);
    const size = Number(query.size || 10);

    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) {
        throw new AppError(400, "参数错误");
    }

    return { page, size };
}

function buildWhereClause(query) {
    const where = {};

    if (query.operatorId) {
        where.userId = query.operatorId;
    }

    if (query.operator) {
        const keyword = String(query.operator).trim();
        if (keyword) {
            where.OR = [
                { userId: { contains: keyword } },
                {
                    user: {
                        is: {
                            OR: [
                                { name: { contains: keyword } },
                                { email: { contains: keyword } }
                            ]
                        }
                    }
                }
            ];
        }
    }

    if (query.action) {
        where.action = query.action;
    }

    if (query.entity) {
        where.entity = query.entity;
    }

    if (query.from || query.to) {
        where.createdAt = {};

        if (query.from) {
            where.createdAt.gte = new Date(query.from);
        }

        if (query.to) {
            where.createdAt.lte = new Date(query.to);
        }
    }

    return where;
}

const toAuditLogDTO = (auditLog) => {
    return {
        id: auditLog.id,
        operator: auditLog.user ? {
            id: auditLog.user.id,
            name: auditLog.user.name,
            email: auditLog.user.email
        } : null,
        action: auditLog.action,
        entity: auditLog.entity,
        entityId: auditLog.entityId,
        detail: auditLog.detail,
        createdAt: formatDateTime(auditLog.createdAt)
    };
};

function normalizeNullableString(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    return String(value);
}

function normalizeDetail(detail) {
    if (detail === null || detail === undefined || detail === "") {
        return null;
    }
    return typeof detail === "string" ? detail : JSON.stringify(detail);
}

function buildAuditLogData(operatorId, action, entity, entityId = null, detail = null) {
    if (!action || typeof action !== "string") {
        throw new AppError(400, "Invalid parameter");
    }

    if (!entity || typeof entity !== "string") {
        throw new AppError(400, "Invalid parameter");
    }

    return {
        userId: normalizeNullableString(operatorId),
        action: action.trim(),
        entity: entity.trim(),
        entityId: normalizeNullableString(entityId),
        detail: normalizeDetail(detail)
    };
}

async function recordWithClient(client, operatorId, action, entity, entityId = null, detail = null) {
    await client.auditLog.create({
        data: buildAuditLogData(operatorId, action, entity, entityId, detail)
    });
}

async function record(operatorId, action, entity, entityId = null, detail = null) {
    await recordWithClient(prisma, operatorId, action, entity, entityId, detail);
}

async function list(query) {
    const { page, size } = parsePagination(query);
    const where = buildWhereClause(query);

    const skip = (page - 1) * size;

    const [total, auditLogs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip,
            take: size
        })
    ]);

    const list = auditLogs.map(toAuditLogDTO);

    return {
        total,
        page,
        size,
        list
    };
}

module.exports = {
    record,
    recordWithClient,
    list
};
