import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";

async function getVideo(id: number) {
  const result = await db.query(
    `
    SELECT id
    FROM media
    WHERE id = $1
      AND media_type = 'video'
      AND visibility = 'public'
      AND expires_at > NOW()
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ID vidéo invalide"
        },
        { status: 400 }
      );
    }

    const video = await getVideo(id);

    if (!video) {
      return NextResponse.json(
        {
          success: false,
          error: "Vidéo introuvable ou expirée"
        },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);

    const limitRaw = Number(searchParams.get("limit") || 50);
    const offsetRaw = Number(searchParams.get("offset") || 0);

    const limit = Math.min(
      Math.max(
        Number.isFinite(limitRaw) ? limitRaw : 50,
        1
      ),
      100
    );

    const offset = Math.max(
      Number.isFinite(offsetRaw) ? offsetRaw : 0,
      0
    );

    const result = await db.query(
      `
      SELECT
        mc.id,
        mc.media_id,
        mc.user_id,
        mc.content,
        mc.created_at,
        mc.updated_at,
        COALESCE(
          u.full_name,
          CONCAT_WS(' ', u.first_name, u.last_name),
          'Utilisateur'
        ) AS user_name,
        u.profile_photo
      FROM media_comments mc
      LEFT JOIN users u
        ON u.id = mc.user_id
      WHERE mc.media_id = $1
      ORDER BY mc.created_at DESC
      LIMIT $2
      OFFSET $3
      `,
      [id, limit, offset]
    );

    const comments = result.rows.map((row: any) => ({
      id: row.id,
      mediaId: row.media_id,
      user: {
        id: row.user_id,
        name: row.user_name,
        avatarUrl: row.profile_photo || null
      },
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return NextResponse.json({
      success: true,
      comments,
      pagination: {
        limit,
        offset,
        count: comments.length
      }
    });
  } catch (error) {
    console.error("VIDEO_COMMENTS_LIST_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de récupérer les commentaires"
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentification requise"
        },
        { status: 401 }
      );
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ID vidéo invalide"
        },
        { status: 400 }
      );
    }

    const video = await getVideo(id);

    if (!video) {
      return NextResponse.json(
        {
          success: false,
          error: "Vidéo introuvable ou expirée"
        },
        { status: 404 }
      );
    }

    let body: any;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Corps JSON invalide"
        },
        { status: 400 }
      );
    }

    const content =
      typeof body?.content === "string"
        ? body.content.trim()
        : "";

    if (!content) {
      return NextResponse.json(
        {
          success: false,
          error: "Le commentaire est requis"
        },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        {
          success: false,
          error: "Le commentaire est trop long"
        },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      INSERT INTO media_comments (
        media_id,
        user_id,
        content
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        media_id,
        user_id,
        content,
        created_at,
        updated_at
      `,
      [
        id,
        Number(user.id),
        content
      ]
    );

    const comment = result.rows[0];

    const userResult = await db.query(
      `
      SELECT
        id,
        full_name,
        first_name,
        last_name,
        profile_photo
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [Number(user.id)]
    );

    const commentUser = userResult.rows[0];

    return NextResponse.json(
      {
        success: true,
        comment: {
          id: comment.id,
          mediaId: comment.media_id,
          user: {
            id: comment.user_id,
            name:
              commentUser?.full_name ||
              [
                commentUser?.first_name,
                commentUser?.last_name
              ]
                .filter(Boolean)
                .join(" ") ||
              "Utilisateur",
            avatarUrl:
              commentUser?.profile_photo || null
          },
          content: comment.content,
          createdAt: comment.created_at,
          updatedAt: comment.updated_at
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("VIDEO_COMMENT_CREATE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible d'ajouter le commentaire"
      },
      { status: 500 }
    );
  }
}
