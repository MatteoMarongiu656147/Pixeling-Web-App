/** Searches pixel content and Pixeling users independently. */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { getAllUserProfiles } from '../services/userProfileService';
import { getAllArtworks } from '../services/artworkService';
import { getAllSprites } from '../services/spriteService';
import { getAllProjects } from '../services/projectService';
import type { Artwork } from '../types/artwork';
import type { Sprite } from '../types/sprite';
import type { Project } from '../types/project';
import type { UserProfile } from '../types/UserProfile';

import ArtworkGrid from '../components/artwork/ArtworkGrid';
import SpriteGrid from '../components/sprite/SpriteGrid';
import ProjectGrid from '../components/project/ProjectGrid';

// ---------------------------------------------------------------------------

// "pixels": search for content; "pixelers": search for users.
type SearchTab = 'pixels' | 'pixelers';

// -------------------------------------------------------------------------------

// UTILITY

/**
 * Matches text terms against searchable fields and #terms against tags.
 * All terms must match for a content item to be included.
 * Used to filter Firestore results after their public collections are loaded.
 */
function matchesContentSearch(searchableValues: string[],
                              tags: string[],
                              searchQuery: string
                             ): boolean {

    const normalizedValues = searchableValues.map((currentValue) =>
      currentValue.toLowerCase()
    );

    const normalizedTags = tags.map((currentTag) =>
      currentTag.toLowerCase()
    );

    const searchTerms = searchQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((currentTerm) => currentTerm.length > 0);

    const textTerms = searchTerms.filter(
      (currentTerm) => !currentTerm.startsWith('#')
    );

    const tagTerms = searchTerms
      .filter((currentTerm) => currentTerm.startsWith('#'))
      .map((currentTerm) => currentTerm.slice(1))
      .filter((currentTerm) => currentTerm.length > 0);

    const textMatches = textTerms.every((currentTerm) =>
      normalizedValues.some((currentValue) =>
        currentValue.includes(currentTerm)
      )
    );

    const tagsMatch = tagTerms.every((currentTerm) =>
      normalizedTags.some((currentTag) => currentTag === currentTerm)
    );

    return textMatches && tagsMatch;
}


// --------------------------------------------------------------------------------

// COMPONENT

function SearchPage() {
  // useSearchParams reads the URL parameters and lets us update them.
  const [searchParams, setSearchParams] = useSearchParams();

  // Content parameters can use `q` or the older `tag` link format.
  const contentQueryFromUrl = searchParams.has('q')
    ? searchParams.get('q') ?? ''
    : searchParams.get('tag') ?? '';

  // The `user` parameter stores the Pixelers search query.
  const userQueryFromUrl = searchParams.get('user') ?? '';

  // The active tab only changes what is shown; both search values are preserved.
  // Open the user search directly when the URL only contains a user query.
  const initialTab: SearchTab = userQueryFromUrl && !contentQueryFromUrl ? 'pixelers' : 'pixels';
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab);

  // Each input has its own state so editing one search does not change the other.
  const [contentQuery, setContentQuery] = useState(contentQueryFromUrl);
  const [userQuery, setUserQuery] = useState(userQueryFromUrl);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userSearchError, setUserSearchError] = useState('');
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [contentSearchError, setContentSearchError] = useState('');

  // Load each public content collection once, then filter its results locally.
  // Firestore has no built-in full-text search, so this keeps the current search
  // behavior without issuing a new database read for every keystroke.
  useEffect(() => {
    let isActive = true;

    async function loadContent() {
      setIsLoadingContent(true);
      setContentSearchError('');

      try {
        const [loadedArtworks, loadedSprites, loadedProjects] =
          await Promise.all([
            getAllArtworks(),
            getAllSprites(),
            getAllProjects(),
          ]);

        if (isActive) {
          setArtworks(loadedArtworks);
          setSprites(loadedSprites);
          setProjects(loadedProjects);
        }
      } catch (error) {
        if (isActive) {
          console.error('Unable to load searchable content:', error);
          setContentSearchError(
            'Unable to load pixel content. Please try again.'
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingContent(false);
        }
      }
    }

    void loadContent();

    return () => {
      // Ignore results if the user leaves the page before the reads finish.
      isActive = false;
    };
  }, []);

  // Load public profiles from Firestore for the Pixelers search.
  useEffect(() => {
    let isActive = true;

    async function loadUsers() {
      setIsLoadingUsers(true);
      setUserSearchError('');

      try {
        const loadedUsers = await getAllUserProfiles();

        if (isActive) {
          setUsers(loadedUsers);
        }
      } catch {
        if (isActive) {
          setUserSearchError(
            'Unable to load Pixelers. Please try again.'
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingUsers(false);
        }
      }
    }

    void loadUsers();

    return () => {
      // Ignore the result if this page has been closed before loading finishes.
      isActive = false;
    };
  }, []);

  /* useEffect is needed because useState only uses its initial value when the
  component mounts. If the URL changes while SearchPage is already open,
  useState alone will not automatically update the search query. */
  useEffect(() => {
    setContentQuery(contentQueryFromUrl);
  }, [contentQueryFromUrl]);

  useEffect(() => {
    setUserQuery(userQueryFromUrl);
  }, [userQueryFromUrl]);

  // Updates one URL parameter and preserves the other search value.
  function updateSearchParam(name: 'q' | 'user', value: string) {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (value.trim()) {
      nextSearchParams.set(name, value);
    } else {
      nextSearchParams.delete(name);
    }

    if (name === 'q') {
      // A manually edited content query replaces the old tag query.
      nextSearchParams.delete('tag');
    }

    setSearchParams(nextSearchParams, { replace: true });
  }

  // Called by the content input to update its state and the `q` URL parameter.
  function handleContentSearchChange(nextQuery: string) {
    setContentQuery(nextQuery);
    updateSearchParam('q', nextQuery);
  }

  // Called by the Pixelers input to update its state and the `user` parameter.
  function handleUserSearchChange(nextQuery: string) {
    setUserQuery(nextQuery);
    updateSearchParam('user', nextQuery);
  }

  // Search is case-insensitive; a leading @ is optional for usernames.
  
  const normalizedContentQuery = contentQuery.trim().toLowerCase();

  const normalizedUserQuery = userQuery.trim().replace(/^@/, '').toLowerCase();

  // ========================
  // FILTER MATCHING CONTENT
  // ========================

  const matchingUsers = users.filter((currentUser) =>
    [
      currentUser.username,
      currentUser.displayName,
      currentUser.bio,
    ].some((currentValue) =>
      currentValue.toLowerCase().includes(normalizedUserQuery)
    )
  );

  const matchingArtworks = artworks.filter((currentArtwork) =>
    matchesContentSearch(
      [
        currentArtwork.title,
        currentArtwork.description ?? '',
        currentArtwork.artistUsername ?? '',
      ],
      currentArtwork.tags ?? [],
      contentQuery
    )
  );

  const matchingSprites = sprites.filter((currentSprite) =>
    matchesContentSearch(
      [
        currentSprite.title,
        currentSprite.description ?? '',
        currentSprite.artistUsername ?? '',
      ],
      currentSprite.tags ?? [],
      contentQuery
    )
  );

  const matchingProjects = projects.filter((currentProject) =>
    matchesContentSearch(
      [
        currentProject.title,
        currentProject.description ?? '',
        currentProject.artistUsername ?? '',
      ],
      currentProject.tags ?? [],
      contentQuery
    )
  );

  const hasContentResults =
    matchingArtworks.length > 0 ||
    matchingSprites.length > 0 ||
    matchingProjects.length > 0;


  // ===============
  // PAGE RENDERING
  // ===============
  
  return (
    <main className="main-content search-page">
      <header className="page-header">
        <h1>Search</h1>
        <p className="section-description">
          Find pixel art, sprites, projects, and artists.
        </p>
      </header>

      {/* Let the user choose which search form and results are visible. */}
      <nav className="profile-tabs" aria-label="Search type">
        <button
          type="button"
          className={activeTab === 'pixels' ? 'active' : ''}
          aria-pressed={activeTab === 'pixels'}
          onClick={() => setActiveTab('pixels')}
        >
          Search for Pixels
        </button>
        <button
          type="button"
          className={activeTab === 'pixelers' ? 'active' : ''}
          aria-pressed={activeTab === 'pixelers'}
          onClick={() => setActiveTab('pixelers')}
        >
          Search for Pixelers
        </button>
      </nav>

      {activeTab === 'pixels' && (
        <section className="search-section" aria-labelledby="pixels-search-title">
          <h2 className="search-section-title" id="pixels-search-title">
            Search for Pixels
          </h2>

          <div className="search-form">
            <label htmlFor="pixel-content-search">Search pixel content</label>
            <input
              id="pixel-content-search"
              type="search"
              value={contentQuery}
              onChange={(event) => handleContentSearchChange(event.target.value)}
              placeholder="Search artworks, sprites, or projects..."
            />
          </div>

          {isLoadingContent ? (
            <p className="section-description search-message">
              Loading pixel content...
            </p>
          ) : contentSearchError ? (
            <p className="section-description search-message" role="alert">
              {contentSearchError}
            </p>
          ) : !normalizedContentQuery ? (
            <p className="section-description search-message">
              Enter a name or tag, or both to find pixel content. You can also write multiple tags 
              (e.g. #fantasy #animation #background) to find content with all those tags.
            </p>
          ) : !hasContentResults ? (
            <p className="section-description search-message">
              No pixel content found for &quot;{contentQuery.trim()}&quot;.
            </p>
          ) : (
            <div className="search-results">
              {matchingArtworks.length > 0 && (
                <section className="search-result-section">
                  <h3>Artworks ({matchingArtworks.length})</h3>
                  <ArtworkGrid artworks={matchingArtworks} />
                </section>
              )}

              {matchingSprites.length > 0 && (
                <section className="search-result-section">
                  <h3>Sprites ({matchingSprites.length})</h3>
                  <SpriteGrid sprites={matchingSprites} />
                </section>
              )}

              {matchingProjects.length > 0 && (
                <section className="search-result-section">
                  <h3>Projects ({matchingProjects.length})</h3>
                  <ProjectGrid projects={matchingProjects} />
                </section>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === 'pixelers' && (
        <section className="search-section" aria-labelledby="pixelers-search-title">
          <h2 className="search-section-title" id="pixelers-search-title">
            Search for Pixelers
          </h2>

          <div className="search-form">
            <label htmlFor="pixelers-search">Search Pixelers</label>
            <input
              id="pixelers-search"
              type="search"
              value={userQuery}
              onChange={(event) => handleUserSearchChange(event.target.value)}
              placeholder="Search by username, name, or bio..."
            />
          </div>

          {isLoadingUsers ? (
            <p className="section-description search-message">
              Loading Pixelers...
            </p>
          ) : userSearchError ? (
            <p className="section-description search-message" role="alert">
              {userSearchError}
            </p>
          ) : !normalizedUserQuery ? (
            <p className="section-description search-message">
              Enter a username, name, or keyword to find Pixelers.
            </p>
          ) : matchingUsers.length === 0 ? (
            <p className="section-description search-message">
              No Pixelers found for &quot;{userQuery.trim()}&quot;.
            </p>
          ) : (
            <div className="search-results">
              <section className="search-result-section">
                <h3>Pixelers ({matchingUsers.length})</h3>
                <div className="search-user-list">
                  {matchingUsers.map((currentUser) => (
                    <Link
                      className="search-user"
                      key={currentUser.uid}
                      to={`/profile/${encodeURIComponent(currentUser.username)}`}
                    >
                      <img
                        src={
                          currentUser.profilePictureUrl ||
                          'https://placehold.co/200x200?text=Pixeling'
                        }
                        alt=""
                      />
                      <div>
                        <h4>{currentUser.displayName}</h4>
                        <p>@{currentUser.username}</p>
                        <p>{currentUser.bio}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default SearchPage;
