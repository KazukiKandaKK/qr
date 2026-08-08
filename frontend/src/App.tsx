import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useApolloClient } from '@apollo/client'
import {
  GET_FEEDS,
  GET_ARTICLES,
  GET_STATS,
  CREATE_FEED,
  FETCH_FEEDS,
  MARK_ARTICLE_READ,
  MARK_ARTICLE_STARRED,
  DELETE_ARTICLE,
  ME,
} from './graphql'
import { Login } from './Login'
import './index.css'

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [selectedFeedId, setSelectedFeedId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [onlyStarred, setOnlyStarred] = useState(false)

  const client = useApolloClient()
  const { data: meData, loading: meLoading } = useQuery(ME, { skip: !token })
  const { data: feedData, refetch: refetchFeeds } = useQuery(GET_FEEDS, {
    skip: !token,
  })
  const { data: statsData, refetch: refetchStats } = useQuery(GET_STATS, {
    skip: !token,
  })
  const { data: articleData, refetch: refetchArticles } = useQuery(
    GET_ARTICLES,
    {
      skip: !token,
      variables: {
        filter: {
          feedId: selectedFeedId || undefined,
          keyword: keyword || undefined,
          isRead: onlyUnread ? false : undefined,
          isStarred: onlyStarred || undefined,
        },
      },
    },
  )

  const [createFeed] = useMutation(CREATE_FEED)
  const [fetchFeeds] = useMutation(FETCH_FEEDS)
  const [markRead] = useMutation(MARK_ARTICLE_READ)
  const [markStarred] = useMutation(MARK_ARTICLE_STARRED)
  const [deleteArticle] = useMutation(DELETE_ARTICLE)

  const [newFeed, setNewFeed] = useState({ name: '', url: '', category: '' })
  const [fetchResult, setFetchResult] = useState<string | null>(null)

  const isAdmin = meData?.me?.role === 'ADMIN'

  const handleLogin = async () => {
    await client.clearStore()
    setToken(localStorage.getItem('token'))
  }

  const handleLogout = async () => {
    await client.clearStore()
    localStorage.removeItem('token')
    setToken(null)
  }

  const handleCreateFeed = async (e: FormEvent) => {
    e.preventDefault()
    if (!newFeed.name || !newFeed.url || !newFeed.category) return
    await createFeed({ variables: { input: { ...newFeed, enabled: true } } })
    setNewFeed({ name: '', url: '', category: '' })
    await refetchFeeds()
  }

  const handleFetch = async () => {
    const { data } = await fetchFeeds()
    const results = data?.fetchFeeds ?? []
    const summary = results
      .map(
        (r: {
          feedName: string
          inserted: number
          updated: number
          error?: string
        }) =>
          `${r.feedName}: ${r.error ? `error ${r.error}` : `+${r.inserted} ~${r.updated}`}`,
      )
      .join('\n')
    setFetchResult(summary || 'No feeds fetched')
    await refetchArticles()
    await refetchStats()
  }

  const handleToggleRead = async (id: string, isRead: boolean) => {
    await markRead({ variables: { id, isRead: !isRead } })
    await refetchArticles()
    await refetchStats()
  }

  const handleToggleStar = async (id: string, isStarred: boolean) => {
    await markStarred({ variables: { id, isStarred: !isStarred } })
    await refetchArticles()
    await refetchStats()
  }

  const handleDelete = async (id: string) => {
    await deleteArticle({ variables: { id } })
    await refetchArticles()
    await refetchStats()
  }

  if (!token) {
    return <Login onLogin={handleLogin} />
  }

  if (meLoading) {
    return <div className="loading">Loading...</div>
  }

  if (!meData?.me) {
    return <Login onLogin={handleLogin} />
  }

  const stats = statsData?.stats

  return (
    <div className="app">
      <header>
        <h1>RSS Security Dashboard</h1>
        <div className="user-info">
          <span>{meData.me.email}</span>
          <span className="badge">{meData.me.role}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main>
        <section className="card stats">
          <h2>Stats</h2>
          <div className="stats-grid">
            <div className="stat">
              <strong>{stats?.feedCount ?? 0}</strong>
              <span>Feeds</span>
            </div>
            <div className="stat">
              <strong>{stats?.articleCount ?? 0}</strong>
              <span>Articles</span>
            </div>
            <div className="stat">
              <strong>{stats?.unreadCount ?? 0}</strong>
              <span>Unread</span>
            </div>
            <div className="stat">
              <strong>{stats?.starredCount ?? 0}</strong>
              <span>Starred</span>
            </div>
          </div>
        </section>
        <section className="card">
          <h2>Feeds</h2>
          <form onSubmit={handleCreateFeed} className="form-row">
            <input
              placeholder="Name"
              value={newFeed.name}
              onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
            />
            <input
              placeholder="URL"
              value={newFeed.url}
              onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
            />
            <input
              placeholder="Category"
              value={newFeed.category}
              onChange={(e) =>
                setNewFeed({ ...newFeed, category: e.target.value })
              }
            />
            <button type="submit">Add Feed</button>
          </form>

          <div className="toolbar">
            <select
              value={selectedFeedId}
              onChange={(e) => setSelectedFeedId(e.target.value)}
            >
              <option value="">All feeds</option>
              {feedData?.feeds?.map(
                (feed: { id: string; name: string }) => (
                  <option key={feed.id} value={feed.id}>
                    {feed.name}
                  </option>
                ),
              )}
            </select>

            <input
              placeholder="Keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />

            <label>
              <input
                type="checkbox"
                checked={onlyUnread}
                onChange={(e) => setOnlyUnread(e.target.checked)}
              />
              Unread only
            </label>

            <label>
              <input
                type="checkbox"
                checked={onlyStarred}
                onChange={(e) => setOnlyStarred(e.target.checked)}
              />
              Starred only
            </label>

            <button onClick={handleFetch}>Fetch feeds</button>
          </div>

          {fetchResult && (
            <pre className="result">{fetchResult}</pre>
          )}

          <ul className="feed-list">
            {feedData?.feeds?.map(
              (feed: {
                id: string
                name: string
                url: string
                category: string
                enabled: boolean
              }) => (
                <li key={feed.id}>
                  <strong>{feed.name}</strong>
                  <span className="muted">{feed.category}</span>
                  <a href={feed.url} target="_blank" rel="noreferrer">
                    {feed.url}
                  </a>
                  <span className="badge">{feed.enabled ? 'on' : 'off'}</span>
                </li>
              ),
            )}
          </ul>
        </section>

        <section className="card">
          <h2>Articles ({articleData?.articles?.length ?? 0})</h2>
          <ul className="article-list">
            {articleData?.articles?.map(
              (article: {
                id: string
                title: string
                link: string
                snippet: string
                publishedAt: string
                isRead: boolean
                isStarred: boolean
                feed: { name: string }
              }) => (
                <li
                  key={article.id}
                  className={article.isRead ? 'read' : 'unread'}
                >
                  <div className="article-header">
                    <a
                      href={article.link}
                      target="_blank"
                      rel="noreferrer"
                      className="title"
                    >
                      {article.title || '(no title)'}
                    </a>
                    <span className="muted">{article.feed.name}</span>
                    <span className="muted">
                      {new Date(article.publishedAt).toLocaleString()}
                    </span>
                  </div>
                  <p>{article.snippet}</p>
                  <div className="actions">
                    <button
                      onClick={() =>
                        handleToggleRead(article.id, article.isRead)
                      }
                    >
                      {article.isRead ? 'Mark unread' : 'Mark read'}
                    </button>
                    <button
                      onClick={() =>
                        handleToggleStar(article.id, article.isStarred)
                      }
                    >
                      {article.isStarred ? 'Unstar' : 'Star'}
                    </button>
                    {isAdmin && (
                      <button onClick={() => handleDelete(article.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              ),
            )}
          </ul>
        </section>
      </main>
    </div>
  )
}

export default App
