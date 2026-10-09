import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";

const BASE_URL = "https://app.cashpay-all.com";

async function getVideo(id: number, userId: number | null) {
  const result = await db.query(
    `
    SELECT
      m.id,
      m.owner_type,
      m.owner_id,
      m.file_name,
      m.file_path,
      m.mime_type,
      m.file_size,
      m.visibility,
      m.created_at,
      m.updated_at,
      m.expires_at,
      m.file_url,
      m.duration_seconds,
      m.thumbnail_url,

      COALESCE(
        (
          SELECT COUNT(*)
          FROM media_likes ml
          WHERE ml.media_id = m.id
        ),
        0
      ) AS likes_count,

      COALESCE(
        (
          SELECT COUNT(*)
          FROM media_comments mc
          WHERE mc.media_id = m.id
        ),
        0
      ) AS comments_count,

      CASE
        WHEN $2::integer IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM media_likes ml2
          WHERE ml2.media_id = m.id
            AND ml2.user_id = $2
        )
      END AS is_liked

    FROM media m
    WHERE m.id = $1
      AND m.media_type = 'video'
      AND m.visibility = 'public'
      AND m.expires_at > NOW()
    LIMIT 1
    `,
    [id, userId]
  );

  return result.rows[0] || null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    const userId = user?.id ? Number(user.id) : null;

    const { id: rawId } = await context.params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: "ID vidéo invalide" },
        { status: 400 }
      );
    }

    const video = await getVideo(id, userId);

    if (!video) {
      return NextResponse.json(
        { success: false, error: "Vidéo introuvable" },
        { status: 404 }
      );
    }

    let publisher: any = {
      type: video.owner_type,
      id: video.owner_id
    };

    if (video.owner_type === "user") {
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
        [video.owner_id]
      );

      if (userResult.rows[0]) {
        const p = userResult.rows[0];

        publisher = {
          type: "user",
          id: p.id,
          name:
            p.full_name ||
            [p.first_name, p.last_name]
              .filter(Boolean)
              .join(" ") ||
            "Utilisateur",
          avatarUrl: p.profile_photo || null
        };
      }
    } else {
      const entityResult = await db.query(
        `
        SELECT
          id,
          entity_type,
          entity_name,
          profile_photo
        FROM followable_entities
        WHERE id = $1
          AND entity_type = $2
        LIMIT 1
        `,
        [video.owner_id, video.owner_type]
      );

      if (entityResult.rows[0]) {
        const p = entityResult.rows[0];

        publisher = {
          type: p.entity_type,
          id: p.id,
          name: p.entity_name,
          avatarUrl: p.profile_photo || null
        };
      }
    }

    return NextResponse.json({
      success: true,
      video: {
        id: video.id,
        type: "video",
        url:
          video.file_url ||
          (video.file_path
            ? `${BASE_URL}${video.file_path}`
            : null),
        thumbnailUrl: video.thumbnail_url,
        durationSeconds: video.duration_seconds,
        visibility: video.visibility,
        createdAt: video.created_at,
        updatedAt: video.updated_at,
        expiresAt: video.expires_at,
        publisher
      },
      interactions: {
        likes: Number(video.likes_count),
        comments: Number(video.comments_count),
        isLiked: Boolean(video.is_liked)
      }
    });
  } catch (error) {
    console.error("VIDEO_DETAIL_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de récupérer la vidéo"
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: "Authentification requise" },
        { status: 401 }
      );
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: "ID vidéo invalide" },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      SELECT
        id,
        owner_type,
        owner_id,
        file_path
      FROM media
      WHERE id = $1
        AND media_type = 'video'
      LIMIT 1
      `,
      [id]
    );

    const video = result.rows[0];

    if (!video) {
      return NextResponse.json(
        { success: false, error: "Vidéo introuvable" },
        { status: 404 }
      );
    }

    if (
      video.owner_type !== "user" ||
      Number(video.owner_id) !== Number(user.id)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Vous ne pouvez pas supprimer cette vidéo"
        },
        { status: 403 }
      );
    }

    await db.query(
      `
      DELETE FROM media
      WHERE id = $1
        AND media_type = 'video'
        AND owner_type = 'user'
        AND owner_id = $2
      `,
      [id, user.id]
    );

    if (video.file_path) {
      const relativePath = String(video.file_path).replace(/^\/+/, "");
      const absolutePath = path.join(
        process.cwd(),
        "public",
        relativePath
      );

      try {
        await fs.unlink(absolutePath);
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: "Vidéo supprimée"
    });
  } catch (error) {
    console.error("VIDEO_DELETE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de supprimer la vidéo"
      },
      { status: 500 }
    );
  }
}
