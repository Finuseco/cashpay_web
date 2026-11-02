'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, Loader2, MessageCircle, Play, Send, Share2, Volume2, VolumeX, X } from 'lucide-react';

type Video = {
  id: number;
  url: string | null;
  thumbnailUrl?: string;
  publisher: { name: string; avatarUrl?: string };
};
type Comment = { id: number; content: string; user: { name: string; avatarUrl?: string } };

async function request(path: string, method = 'GET', body?: object, signal?: AbortSignal) {
  const response = await fetch(path, {
    method, cache: 'no-store', signal: signal || AbortSignal.timeout(20000),
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(response.status === 404
      ? 'Cette vidéo est indisponible, privée ou expirée.'
      : data.error || 'Chargement impossible. Veuillez réessayer.');
  }
  return data;
}

export function SharedVideoPlayer({ videoId, viewerId }: { videoId: number; viewerId: number }) {
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const player = useRef<HTMLVideoElement>(null);
  const loginUrl = `/login?returnTo=${encodeURIComponent(`/onchat/videos/${videoId}`)}`;

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 20000);
    setLoading(true); setVideo(null); setError(''); setBuffering(true);
    void request(`/api/v1/media/videos/${videoId}`, 'GET', undefined, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setVideo(data.video); setLiked(Boolean(data.interactions?.isLiked));
      setLikes(Number(data.interactions?.likes || 0)); setCommentCount(Number(data.interactions?.comments || 0));
    }).catch(reason => {
      if (!disposed) setError(controller.signal.aborted ? 'Le chargement a pris trop de temps. Réessayez.' : reason.message);
    }).finally(() => { clearTimeout(timeout); if (!disposed) setLoading(false); });
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [videoId, retry]);

  useEffect(() => {
    if (!commentsOpen) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    setCommentsLoading(true);
    void request(`/api/v1/media/videos/${videoId}/comments?limit=100`, 'GET', undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setComments(data.comments); })
      .catch(reason => { setNotice(controller.signal.aborted ? 'Chargement des commentaires interrompu. Réessayez.' : reason.message); })
      .finally(() => { clearTimeout(timeout); setCommentsLoading(false); });
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [commentsOpen, videoId]);

  function requireLogin() {
    if (viewerId) return false;
    location.assign(loginUrl);
    return true;
  }
  async function like() {
    if (busy || requireLogin()) return;
    setBusy(true); setNotice('');
    try {
      const data = await request(`/api/v1/media/videos/${videoId}/like`, liked ? 'DELETE' : 'POST');
      setLiked(!liked); setLikes(Number(data.likes));
    } catch (reason: any) { setNotice(reason.message); }
    finally { setBusy(false); }
  }
  async function comment(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !text.trim() || requireLogin()) return;
    setBusy(true); setNotice('');
    try {
      const data = await request(`/api/v1/media/videos/${videoId}/comments`, 'POST', { content: text.trim() });
      setComments(items => [data.comment, ...items.filter(item => item.id !== data.comment.id)]);
      setText(''); setCommentCount(count => count + 1);
    } catch (reason: any) { setNotice(reason.message); }
    finally { setBusy(false); }
  }
  async function share() {
    const url = new URL(`/onchat/videos/${videoId}`, location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: 'Vidéo OnChat', url });
      else { await navigator.clipboard.writeText(url); setNotice('Lien copié.'); }
    } catch (reason: any) { if (reason.name !== 'AbortError') setNotice('Partage indisponible. Copiez le lien dans la barre d’adresse.'); }
  }
  const author = video?.publisher?.name || 'Auteur OnChat';
  const initials = author.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  return <main className="min-h-[100dvh] bg-slate-950 text-white flex flex-col">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-500/30 bg-gradient-to-r from-violet-950 to-slate-950 px-4 py-3">
      <Link href="/feedback" className="flex items-center gap-2 font-bold"><img src="/logos/onchat.png" alt="" className="h-9 w-9 object-contain" />OnChat</Link>
      <div className="flex items-center gap-4 text-sm"><a className="text-cyan-300" href={`onchat://videos/${videoId}`}>Ouvrir dans OnChat</a>{!viewerId && <Link href={loginUrl}>Se connecter</Link>}</div>
    </header>
    {loading && !error && <div role="status" className="flex flex-1 justify-center items-center min-h-64"><Loader2 className="animate-spin h-12 w-12" /><span className="sr-only">Chargement de la vidéo</span></div>}
    {error && <section role="alert" className="max-w-lg mx-auto p-8 text-center"><p>{error}</p><button className="mt-4 rounded-xl bg-violet-600 px-5 py-3" onClick={() => setRetry(value => value + 1)}>Réessayer</button></section>}
    {video && <article className="relative flex-1 mx-auto w-full max-w-xl bg-black h-[calc(100dvh-70px)] min-h-[460px]" aria-label={`Vidéo de ${author}`}>
      {video.url ? <video ref={player} src={video.url} poster={video.thumbnailUrl || undefined} className="absolute inset-0 h-full w-full object-contain" playsInline autoPlay loop muted={muted} controls preload="metadata"
        onWaiting={() => setBuffering(true)} onCanPlay={() => setBuffering(false)} onPlaying={() => { setBuffering(false); setPaused(false); }} onPause={() => setPaused(true)}
        onError={() => { setBuffering(false); setNotice('Lecture impossible. Vérifiez votre connexion ou réessayez.'); }} /> : <p role="alert" className="p-6">Le fichier de cette vidéo est indisponible.</p>}
      {buffering && video.url && <div className="absolute inset-0 pointer-events-none grid place-items-center" role="status"><Loader2 className="h-20 w-20 animate-spin text-cyan-300" /><span className="sr-only">Chargement vidéo</span></div>}
      {paused && !buffering && <button aria-label="Lire la vidéo" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40 p-4" onClick={() => void player.current?.play().catch(() => setNotice('Appuyez sur le lecteur pour lancer la vidéo.'))}><Play className="h-12 w-12" /></button>}
      <button className="absolute top-4 right-4 rounded-full bg-black/60 p-3" aria-label={muted ? 'Activer le son' : 'Couper le son'} onClick={() => setMuted(value => !value)}>{muted ? <VolumeX /> : <Volume2 />}</button>
      <div className="absolute bottom-20 left-4 right-20 rounded-xl bg-black/60 p-3 flex items-center gap-3">
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-violet-800 grid place-items-center font-bold">{initials}{video.publisher?.avatarUrl && <img src={video.publisher.avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.hidden = true; }} />}</span><span className="font-semibold break-words">{author}</span>
      </div>
      <div className="absolute right-4 bottom-24 flex flex-col gap-6 text-center">
        <button disabled={busy} onClick={() => void like()} aria-label="J’aime"><Heart className={liked ? 'fill-rose-500 text-rose-500' : ''} /><span className="text-xs">{likes}</span></button>
        <button onClick={() => { setCommentsOpen(true); player.current?.pause(); }} aria-label="Commentaires"><MessageCircle /><span className="text-xs">{commentCount}</span></button>
        <button onClick={() => void share()} aria-label="Partager"><Share2 /></button>
      </div>
      {notice && <p role="status" className="absolute top-20 left-4 right-4 rounded-lg bg-slate-900/95 p-3 text-amber-200">{notice}</p>}
      {commentsOpen && <section className="absolute bottom-0 inset-x-0 z-20 h-[75%] rounded-t-3xl bg-slate-950 border-t border-violet-500 p-4 flex flex-col" aria-label="Commentaires de la vidéo">
        <div className="flex justify-between items-center"><h2 className="font-bold">Commentaires</h2><button aria-label="Fermer les commentaires" onClick={() => setCommentsOpen(false)}><X /></button></div>
        <div className="flex-1 overflow-y-auto py-4 space-y-4">{commentsLoading && <Loader2 aria-label="Chargement des commentaires" className="animate-spin" />}{!commentsLoading && !comments.length && <p className="text-slate-400">Soyez le premier à commenter.</p>}{comments.map(item => <div key={item.id}><p className="text-cyan-300 text-sm font-semibold">{item.user.name}</p><p className="whitespace-pre-wrap break-words">{item.content}</p></div>)}</div>
        {notice && <p role="status" className="pb-2 text-sm text-amber-200">{notice}</p>}
        {viewerId ? <form onSubmit={comment} className="flex gap-2"><textarea className="min-w-0 flex-1 rounded-xl bg-slate-800 p-3" placeholder="Ajouter un commentaire…" maxLength={5000} value={text} onChange={event => setText(event.target.value)} disabled={busy} /><button type="submit" disabled={busy || !text.trim()} aria-label="Envoyer le commentaire" className="rounded-xl bg-violet-600 px-4">{busy ? <Loader2 className="animate-spin" /> : <Send />}</button></form> : <Link className="rounded-xl bg-violet-600 p-3 text-center" href={loginUrl}>Se connecter pour commenter</Link>}
      </section>}
    </article>}
  </main>;
}
