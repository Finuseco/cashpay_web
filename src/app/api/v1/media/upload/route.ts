import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";

import { CHAT_MIME_EXTENSIONS, attachmentLimit, attachmentDiskPath } from '@/lib/chat-attachments';

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

    const formData = await request.formData();

    const file = formData.get("video") ?? formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Le fichier vidéo est requis dans le champ video ou file"
        },
        { status: 400 }
      );
    }

    // The video field retains the existing public reel publication contract.
    // The file field stores a conversation attachment outside the public directory.
    if (!formData.has("video")) {
      const mimeType = file.type.toLowerCase();
      const extension = CHAT_MIME_EXTENSIONS[mimeType];
      if (!extension) return NextResponse.json({ success: false, error: "Format de fichier non autorisé" }, { status: 415 });
      if (file.size <= 0 || file.size > attachmentLimit(mimeType)) {
        return NextResponse.json({ success: false, error: "Taille de fichier invalide" }, { status: file.size > 0 ? 413 : 400 });
      }
      const name = `${crypto.randomUUID()}${extension}`;
      const target = attachmentDiskPath(String(user.id), name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, Buffer.from(await file.arrayBuffer()));
      return NextResponse.json({ success: true, url: `/api/uploads/onchat/${user.id}/${name}`, fileName: file.name, mimeType, fileSize: file.size }, { status: 201 });
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
        {
          success: false,
          error: "La vidéo est vide"
        },
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
        {
          success: false,
          error: "publisherId invalide"
        },
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
          error:
            "Le diffuseur demandé n'existe pas ou n'appartient pas à l'utilisateur"
        },
        { status: 403 }
      );
    }

    const durationRaw = formData.get("durationSeconds");

    const durationSeconds = durationRaw
      ? Number(durationRaw)
      : null;

    if (
      durationSeconds !== null &&
      (!Number.isFinite(durationSeconds) || durationSeconds < 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "durationSeconds invalide"
        },
        { status: 400 }
      );
    }

    const thumbnailUrlRaw = formData.get("thumbnailUrl");

    const thumbnailUrl =
      typeof thumbnailUrlRaw === "string" && thumbnailUrlRaw.trim()
        ? thumbnailUrlRaw.trim()
        : null;

    const buffer = Buffer.from(await file.arrayBuffer());

    const extension = getExtension(
      file.name,
      file.type
    );

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

    await fs.writeFile(
      absoluteFilePath,
      buffer
    );

    const fileUrl =
      `${BASE_URL}/${relativeDirectory}/${fileName}`;

    const result = await db.query(
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
      ]
    );

    const media = result.rows[0];

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
    console.error("MEDIA_UPLOAD_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de publier la vidéo"
      },
      { status: 500 }
    );
  }
}
