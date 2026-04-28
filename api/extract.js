const API_BASE = 'https://www.googleapis.com/youtube/v3';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server is missing YOUTUBE_API_KEY. Add it in Vercel project settings.'
    });
  }

  const { url, mode } = req.body || {};
  if (!url || !mode) {
    return res.status(400).json({ error: 'Missing url or mode in request body.' });
  }

  try {
    let playlistId;
    if (mode === 'playlist') {
      playlistId = parsePlaylistId(url);
      if (!playlistId) {
        return res.status(400).json({
          error: 'Could not find a playlist ID in that URL. Make sure it contains "list=PL..." or similar.'
        });
      }
    } else if (mode === 'channel') {
      playlistId = await resolveChannelUploadsPlaylist(url, apiKey);
      if (!playlistId) {
        return res.status(400).json({
          error: 'Could not resolve that channel. Try the @handle URL or the /channel/UC... URL.'
        });
      }
    } else {
      return res.status(400).json({ error: 'Invalid mode. Use "playlist" or "channel".' });
    }

    const videos = await fetchAllPlaylistVideos(playlistId, apiKey);
    return res.status(200).json({ count: videos.length, videos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Unexpected error.' });
  }
}

function parsePlaylistId(input) {
  const trimmed = input.trim();
  if (/^(PL|UU|FL|RD|OL|LL)[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    const list = u.searchParams.get('list');
    if (list) return list;
  } catch {}
  const m = trimmed.match(/[?&]list=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function resolveChannelUploadsPlaylist(input, apiKey) {
  const trimmed = input.trim();
  let channelId = null;

  const directId = trimmed.match(/channel\/(UC[A-Za-z0-9_-]{20,})/);
  if (directId) {
    channelId = directId[1];
  } else if (/^UC[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    channelId = trimmed;
  } else {
    const handleMatch = trimmed.match(/\/@([A-Za-z0-9._-]+)/) || trimmed.match(/^@([A-Za-z0-9._-]+)$/);
    const userMatch = trimmed.match(/\/user\/([A-Za-z0-9._-]+)/);
    const customMatch = trimmed.match(/\/c\/([A-Za-z0-9._-]+)/);

    if (handleMatch) {
      channelId = await lookupChannel({ forHandle: '@' + handleMatch[1] }, apiKey);
    } else if (userMatch) {
      channelId = await lookupChannel({ forUsername: userMatch[1] }, apiKey);
    } else if (customMatch) {
      channelId = await searchChannel(customMatch[1], apiKey);
    }
  }

  if (!channelId) return null;

  const params = new URLSearchParams({ part: 'contentDetails', id: channelId, key: apiKey });
  const r = await fetch(`${API_BASE}/channels?${params}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'YouTube API error');
  const item = data.items?.[0];
  return item?.contentDetails?.relatedPlaylists?.uploads || null;
}

async function lookupChannel(extra, apiKey) {
  const params = new URLSearchParams({ part: 'id', key: apiKey, ...extra });
  const r = await fetch(`${API_BASE}/channels?${params}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'YouTube API error');
  return data.items?.[0]?.id || null;
}

async function searchChannel(query, apiKey) {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'channel',
    maxResults: '1',
    key: apiKey
  });
  const r = await fetch(`${API_BASE}/search?${params}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'YouTube API error');
  return data.items?.[0]?.snippet?.channelId || data.items?.[0]?.id?.channelId || null;
}

async function fetchAllPlaylistVideos(playlistId, apiKey) {
  const videos = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50',
      key: apiKey
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch(`${API_BASE}/playlistItems?${params}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || 'YouTube API error');
    for (const item of data.items || []) {
      const videoId = item.contentDetails?.videoId;
      if (!videoId) continue;
      videos.push({
        id: videoId,
        title: item.snippet?.title || '',
        url: `https://www.youtube.com/watch?v=${videoId}`
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return videos;
}
