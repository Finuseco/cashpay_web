import { insertPublishedVideo } from '@/lib/video-sounds';
import { verifiedVideoDuration, VideoPolicyError } from '@/lib/video-policy';
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";

const BASE_URL = "https://app.cashpay-all.com";
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska"
]);

function getExtension(fileName: string, mimeType: string) {
  const map: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "video/x-matroska": ".mkv"
  };

  return map[mimeType] || ".mp4";
}

async function resolvePublisher(
  publisherType: string,
  publisherId: number,
  userId: number
) {
  if (publisherType === "user") {
    if (publisherId !== userId) {
      return null;
    }

    const result = await db.query(
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
      [publisherId]
    );

    if (!result.rows[0]) {
      return null;
    }

    const user = result.rows[0];

    return {
      ownerType: "user",
      ownerId: user.id,
      type: "user",
      id: user.id,
      name:
        user.full_name ||
        [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        "Utilisateur",
      avatarUrl: user.profile_photo || null
    };
  }

  const entity = await db.query(
    `
    SELECT
      id,
      owner_user_id,
      entity_type,
      entity_name,
      profile_photo,
      visibility
    FROM followable_entities
    WHERE id = $1
      AND entity_type = $2
    LIMIT 1
    `,
    [publisherId, publisherType]
  );

  if (!entity.rows[0]) {
    return null;
  }

  const row = entity.rows[0];

  if (Number(row.owner_user_id) !== Number(userId)) {
    return null;
  }

  return {
    ownerType: publisherType,
    ownerId: row.id,
    type: publisherType,
    id: row.id,
    name: row.entity_name,
    avatarUrl: row.profile_photo || null
  };
}

export async function POST(request: NextRequest) {
  let unpublishedFile: string | null = null;
  try {
    const user = await getAuthenticatedUser();

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: "Authentification requise" },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    const file = formData.get("video") ?? formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Le fichier vidéo est requis dans le champ video ou file" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Format vidéo non supporté"
        },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { success: false, error: "La vidéo est vide" },
        { status: 400 }
      );
    }

    if (file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "La vidéo dépasse la taille maximale autorisée de 200 MB"
        },
        { status: 413 }
      );
    }

    const publisherType =
      String(formData.get("publisherType") || "user").trim();

    const publisherIdRaw = formData.get("publisherId");

    const publisherId = publisherIdRaw
      ? Number(publisherIdRaw)
      : Number(user.id);

    if (!Number.isInteger(publisherId) || publisherId <= 0) {
      return NextResponse.json(
        { success: false, error: "publisherId invalide" },
        { status: 400 }
      );
    }

    const publisher = await resolvePublisher(
      publisherType,
      publisherId,
      Number(user.id)
    );

    if (!publisher) {
      return NextResponse.json(
        {
          success: false,
          error: "Le diffuseur demandé n'existe pas ou n'appartient pas à l'utilisateur"
        },
        { status: 403 }
      );
    }

    const durationRaw = formData.get("durationSeconds");
    let durationSeconds = durationRaw
      ? Number(durationRaw)
      : null;

    if (
      durationSeconds !== null &&
      (!Number.isFinite(durationSeconds) || durationSeconds < 0)
    ) {
      return NextResponse.json(
        { success: false, error: "durationSeconds invalide" },
        { status: 400 }
      );
    }

    const thumbnailUrlRaw = formData.get("thumbnailUrl");
    const thumbnailUrl =
      typeof thumbnailUrlRaw === "string" && thumbnailUrlRaw.trim()
        ? thumbnailUrlRaw.trim()
        : null;

    const buffer = Buffer.from(await file.arrayBuffer());
    durationSeconds = Math.ceil(await verifiedVideoDuration(buffer));

    const extension = getExtension(file.name, file.type);
    const fileName = `${crypto.randomUUID()}${extension}`;

    const relativeDirectory = "images/videos";
    const absoluteDirectory = path.join(
      process.cwd(),
      "public",
      relativeDirectory
    );

    await fs.mkdir(absoluteDirectory, {
      recursive: true
    });

    const absoluteFilePath = path.join(
      absoluteDirectory,
      fileName
    );

    unpublishedFile = absoluteFilePath;
    await fs.writeFile(absoluteFilePath, buffer);

    const fileUrl = `${BASE_URL}/${relativeDirectory}/${fileName}`;

    const result = await insertPublishedVideo(
      `
      INSERT INTO media (
        owner_type,
        owner_id,
        media_type,
        file_name,
        file_path,
        mime_type,
        file_size,
        visibility,
        expires_at,
        file_url,
        duration_seconds,
        thumbnail_url
      )
      VALUES (
        $1,
        $2,
        'video',
        $3,
        $4,
        $5,
        $6,
        'public',
        NOW() + INTERVAL '1 month',
        $7,
        $8,
        $9
      )
      RETURNING
        id,
        owner_type,
        owner_id,
        media_type,
        file_name,
        file_path,
        mime_type,
        file_size,
        visibility,
        created_at,
        updated_at,
        expires_at,
        file_url,
        duration_seconds,
        thumbnail_url
      `,
      [
        publisher.ownerType,
        publisher.ownerId,
        file.name,
        `/${relativeDirectory}/${fileName}`,
        file.type,
        file.size,
        fileUrl,
        durationSeconds,
        thumbnailUrl
      ], formData, Number(user.id)
    );

    const media = result.rows[0];
    unpublishedFile = null;

    return NextResponse.json(
      {
        success: true,
        video: {
          id: media.id,
          type: "video",
          url: media.file_url || fileUrl,
          thumbnailUrl: media.thumbnail_url,
          durationSeconds: media.duration_seconds,
          visibility: media.visibility,
          createdAt: media.created_at,
          expiresAt: media.expires_at,
          publisher
        },
        interactions: {
          likes: 0,
          comments: 0,
          isLiked: false
        },
        follow: {
          isFollowing: false
        }
      },
      { status: 201 }
    );
  } catch (error) {
    if (unpublishedFile) await fs.unlink(unpublishedFile).catch(() => undefined);
    if (error instanceof VideoPolicyError) return NextResponse.json({ success: false, error: error.message }, { status: 422 });
    console.error("VIDEO_PUBLISH_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de publier la vidéo"
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const userId = user?.id ? Number(user.id) : null;

    const { searchParams } = new URL(request.url);

    const limitRaw = Number(searchParams.get("limit") || 20);
    const offsetRaw = Number(searchParams.get("offset") || 0);

    const limit = Math.min(
      Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1),
      50
    );

    const offset = Math.max(
      Number.isFinite(offsetRaw) ? offsetRaw : 0,
      0
    );

    const result = await db.query(
      `
      SELECT
        m.id,
        m.owner_type,
        m.owner_id,
        m.media_type,
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
        COALESCE(publisher_user.full_name, publisher_entity.entity_name) AS publisher_name,
        COALESCE(publisher_user.profile_photo, publisher_entity.profile_photo) AS publisher_avatar,
        CASE WHEN $3::integer IS NULL OR m.owner_type <> 'user' THEN FALSE ELSE EXISTS(SELECT 1 FROM user_followers uf WHERE uf.follower_user_id = $3 AND uf.followed_user_id = m.owner_id) END AS is_following,

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
          WHEN $3::integer IS NULL THEN false
          ELSE EXISTS (
            SELECT 1
            FROM media_likes ml2
            WHERE ml2.media_id = m.id
              AND ml2.user_id = $3
          )
        END AS is_liked

      FROM media m
      LEFT JOIN users publisher_user ON m.owner_type = 'user' AND publisher_user.id = m.owner_id
      LEFT JOIN followable_entities publisher_entity ON m.owner_type <> 'user' AND publisher_entity.id = m.owner_id AND publisher_entity.entity_type = m.owner_type
      WHERE m.media_type = 'video'
        AND m.visibility = 'public'
        AND m.expires_at > NOW()

      ORDER BY m.created_at DESC
      LIMIT $1
      OFFSET $2
      `,
      [limit, offset, userId]
    );

    const videos = result.rows.map((row: any) => ({
      id: row.id,
      type: "video",
      url:
        row.file_url ||
        (row.file_path
          ? `${BASE_URL}${row.file_path}`
          : null),
      thumbnailUrl: row.thumbnail_url,
      durationSeconds: row.duration_seconds,
      visibility: row.visibility,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      publisher: {
        type: row.owner_type,
        id: row.owner_id,
        name: row.publisher_name,
        avatarUrl: typeof row.publisher_avatar === "string" && row.publisher_avatar.startsWith("/") ? `${BASE_URL}${row.publisher_avatar}` : row.publisher_avatar
      },
      follow: { isFollowing: Boolean(row.is_following) },
      interactions: {
        likes: Number(row.likes_count),
        comments: Number(row.comments_count),
        isLiked: Boolean(row.is_liked)
      }
    }));

    return NextResponse.json({
      success: true,
      videos,
      pagination: {
        limit,
        offset,
        count: videos.length
      }
    });
  } catch (error) {
    console.error("VIDEO_LIST_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de récupérer les vidéos"
      },
      { status: 500 }
    );
  }
}
