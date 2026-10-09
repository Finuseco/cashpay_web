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

    await db.query(
      `
      INSERT INTO media_likes (
        media_id,
        user_id
      )
      VALUES ($1, $2)
      ON CONFLICT (media_id, user_id) DO NOTHING
      `,
      [id, Number(user.id)]
    );

    const countResult = await db.query(
      `
      SELECT COUNT(*) AS count
      FROM media_likes
      WHERE media_id = $1
      `,
      [id]
    );

    return NextResponse.json({
      success: true,
      liked: true,
      likes: Number(countResult.rows[0].count)
    });
  } catch (error) {
    console.error("VIDEO_LIKE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible d'aimer la vidéo"
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

    await db.query(
      `
      DELETE FROM media_likes
      WHERE media_id = $1
        AND user_id = $2
      `,
      [id, Number(user.id)]
    );

    const countResult = await db.query(
      `
      SELECT COUNT(*) AS count
      FROM media_likes
      WHERE media_id = $1
      `,
      [id]
    );

    return NextResponse.json({
      success: true,
      liked: false,
      likes: Number(countResult.rows[0].count)
    });
  } catch (error) {
    console.error("VIDEO_UNLIKE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de retirer le like"
      },
      { status: 500 }
    );
  }
}
