

'use server';

import type { Movie, TvChannel, JojoVideo } from '../types';
import { db } from '@/lib/db';
import { handleDbError } from './helpers';

// The database schema does not contain tables for series or games.
// For these features to work, corresponding tables would need to be added to the database schema.

export async function getMovies(): Promise<Movie[]> {
  try {
    const { rows } = await db.query('SELECT * FROM cinema_movies ORDER BY release_year DESC');
    return rows.map(row => ({
      id: row.id.toString(),
      title: row.title,
      description: row.description,
      coverPath: row.cover_path,
      rating: 0, // Not in schema
      year: row.release_year,
      duration: `${row.duration_minutes} min`,
    }));
  } catch (error) {
    handleDbError(error, 'fetching cinema movies');
    return [];
  }
}

export async function getSeries(): Promise<Movie[]> {
  console.warn("getSeries was called, but no 'series' table exists in the database schema. Returning empty array.");
  return [];
}

export async function getGames(): Promise<Movie[]> {
  console.warn("getGames was called, but no 'games' table exists in the database schema. Returning empty array.");
  return [];
}

export async function getContinueWatching(userId: number): Promise<Movie[]> {
   console.warn("getContinueWatching was called, but no 'watching_history' table exists in the database schema. Returning empty array.");
  return [];
}

export async function getTvChannels(): Promise<TvChannel[]> {
   console.warn("getTvChannels was called, but no 'tv_channels' table exists in the database schema. Returning empty array.");
  return [];
}

export async function getJojoVideos(): Promise<JojoVideo[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                jv.id,
                jv.video_url as "videoUrl",
                u.full_name as "userName",
                u.id_wallet as "userHandle",
                u.profile_photo as "userAvatar",
                jv.description,
                jv.song_title as "songTitle",
                jv.likes_count as likes,
                jv.comments_count as comments,
                jv.shares_count as shares,
                jv.bookmarks_count as bookmarks
            FROM jojo_videos jv
            JOIN users u ON jv.user_id = u.id
            ORDER BY jv.created_at DESC
        `);
        return rows.map(row => ({
            id: row.id.toString(),
            videoUrl: row.videoUrl,
            user: {
                name: row.userName,
                handle: row.userHandle,
                avatar: row.userAvatar,
            },
            description: row.description,
            songTitle: row.songTitle,
            likes: row.likes,
            comments: row.comments,
            shares: row.shares,
            bookmarks: row.bookmarks
        }));
    } catch (error) {
        handleDbError(error, 'fetching JoJo videos');
        return [];
    }
}
