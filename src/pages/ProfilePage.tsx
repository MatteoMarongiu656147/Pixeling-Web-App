
import { useEffect, useState } from 'react';

import { Link, useParams } from 'react-router';

import { useAuth } from '../contexts/AuthContext';

import {
  getFollowStats,
  getUserProfileByUsername,
  setFollowStatus,
} from '../services/userProfileService';

import type { UserProfile } from '../types/UserProfile';
import type { FollowStats } from '../services/userProfileService';

import {
  deleteArtworkById,
  getArtworksByArtistUid,
} from '../services/artworkService';
import type { Artwork } from '../types/artwork';
import {
  deleteSpriteById,
  getSpritesByArtistUid,
} from '../services/spriteService';
import type { Sprite } from '../types/sprite';
import {
  deleteProjectById,
  getProjectsByArtistUid,
} from '../services/projectService';
import type { Project } from '../types/project';

import ArtworkGrid from '../components/artwork/ArtworkGrid';
import SpriteGrid from '../components/sprite/SpriteGrid';
import ProjectGrid from '../components/project/ProjectGrid';

// --------------------------------------------------------------------------------------------------------------------------

type ProfileTab = 'artworks' | 'sprites' | 'projects';

function ProfilePage() {
  const routeParams = useParams();
  const username = routeParams.username;

  // Listens to the authentication context
  const authState = useAuth();
  const viewerUid = authState.user?.uid ?? null;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [userArtworks, setUserArtworks] = useState<Artwork[]>([]);
  const [isLoadingArtworks, setIsLoadingArtworks] = useState(true);
  const [artworkError, setArtworkError] = useState('');
  const [artworkDeleteError, setArtworkDeleteError] = useState('');

  const [userSprites, setUserSprites] = useState<Sprite[]>([]);
  const [isLoadingSprites, setIsLoadingSprites] = useState(true);
  const [spriteError, setSpriteError] = useState('');
  const [spriteDeleteError, setSpriteDeleteError] = useState('');

  const [firestoreProjects, setFirestoreProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState('');
  const [projectDeleteError, setProjectDeleteError] = useState('');

  const [projectsLoadedForUid, setProjectsLoadedForUid] = useState<string | null>(null);
  const [spritesLoadedForUid, setSpritesLoadedForUid] = useState<string | null>(null);
  const [artworksLoadedForUid, setArtworksLoadedForUid] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ProfileTab>('artworks');
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);

  const [loadedFollowStats, setLoadedFollowStats] = useState<{
    profileUid: string;
    viewerUid: string | null;
    stats: FollowStats;
  } | null>(null);

  const [isLoadingFollowStats, setIsLoadingFollowStats] = useState(false);
  const [followStatsError, setFollowStatsError] = useState('');
  const [followStatsRetry, setFollowStatsRetry] = useState(0);
  const [isFollowSubmitting, setIsFollowSubmitting] = useState(false);
  const followStatsProfileUid = profile?.uid;


  // ===============
  // USE EFFECTS
  // ===============

  // Load the profile identified by the username in the URL (calls userProfileService)
  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      setIsLoading(true);
      setLoadError('');
      setProfile(null);

      if (!username) {
        setIsLoading(false);
        return;
      }

      try {
        // calls userProfileService to get the user's profile by their username
        const loadedProfile = await getUserProfileByUsername(username);

        if (isActive) {
          setProfile(loadedProfile);
        }
      } catch {
        if (isActive) {
          setLoadError('Unable to load this profile. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    // calls the defined function to load the user profile
    void loadProfile();

    return () => {
      // prevent invalid operations when unmounted
      isActive = false;
    };
  }, [username]); // executed each time the username changes



  // Load artworks for the profile UID and ignore results from older requests.
  // Calls artworkService.
  useEffect(() => {
    let isActive = true;
    const profileUid = profile?.uid;

    setUserArtworks([]);
    setArtworksLoadedForUid(null);
    setArtworkError('');
    setArtworkDeleteError('');

    if (!profileUid) {
      setIsLoadingArtworks(false);
      return;
    }

    const requestedProfileUid = profileUid;
    setIsLoadingArtworks(true);

    async function loadArtworks() {
      try {
        // artworkService call: retrieves the artworks of a creator by UID
        const loadedArtworks = await getArtworksByArtistUid(requestedProfileUid);

        if (isActive) {
          setUserArtworks(loadedArtworks);
          setArtworksLoadedForUid(requestedProfileUid);
        }
      } catch (error) {
        if (isActive) {
          console.error('Failed to load profile artworks:', error);
          setArtworkError('Unable to load artworks. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoadingArtworks(false);
        }
      }
    }

    // Calls the loading function
    void loadArtworks();

    return () => {
      // Prevent invalid operations when unmounted
      isActive = false;
    };
  }, [profile?.uid]); // executed whenever the user profile's uid changes



  // Load Firestore projects for this profile and ignore outdated requests.
  // calls projectService
  useEffect(() => {
    let isActive = true;
    const profileUid = profile?.uid;

    setFirestoreProjects([]);
    setProjectsLoadedForUid(null);
    setProjectError('');
    setProjectDeleteError('');

    if (!profileUid) {
      setIsLoadingProjects(false);
      return;
    }

    const requestedProfileUid = profileUid;
    setIsLoadingProjects(true);

    async function loadProjects() {
      try {
        // projectService call to get projects of a creator by UID from firestore 
        const loadedProjects = await getProjectsByArtistUid(
          requestedProfileUid
        );

        if (isActive) {
          setFirestoreProjects(loadedProjects);
          setProjectsLoadedForUid(requestedProfileUid);
        }
      } catch (error) {
        if (isActive) {
          console.error('Failed to load profile projects:', error);
          setProjectError('Unable to load projects. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoadingProjects(false);
        }
      }
    }

    // Calls the function and loads the projects
    void loadProjects();

    return () => {
      // prevent invalid operations
      isActive = false;
    };
  }, [profile?.uid]);


  // Load sprites for the profile UID and ignore results from older requests.
  // Calls spriteService.
  useEffect(() => {
    let isActive = true;
    const profileUid = profile?.uid;

    setUserSprites([]);
    setSpritesLoadedForUid(null);
    setSpriteError('');
    setSpriteDeleteError('');

    if (!profileUid) {
      setIsLoadingSprites(false);
      return;
    }

    const requestedProfileUid = profileUid;
    setIsLoadingSprites(true);

    async function loadSprites() {
      try {
        // spriteService call to get all sprites from a creator by UID from firestore
        const loadedSprites = await getSpritesByArtistUid(requestedProfileUid);

        if (isActive) {
          setUserSprites(loadedSprites);
          setSpritesLoadedForUid(requestedProfileUid);
        }
      } catch (error) {
        if (isActive) {
          console.error('Failed to load profile sprites:', error);
          setSpriteError('Unable to load sprites. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoadingSprites(false);
        }
      }
    }

    // loads the sprites
    void loadSprites();

    return () => {
      // prevent invalid operations
      isActive = false;
    };
  }, [profile?.uid]);



  // Loads the follow/following stats (number of followers, following, etc)
  // These stats are shown in the page (e.g. followers: 2, following: 10)
  // Calls userProfileService to retrieve them
  useEffect(() => {
    let isActive = true;

    async function loadFollowStats() {
      setFollowStatsError('');

      if (!followStatsProfileUid) {
        setIsLoadingFollowStats(false);
        return;
      }

      setIsLoadingFollowStats(true);

      try {
        // userProfileService call
        const followStats = await getFollowStats(followStatsProfileUid, viewerUid);

        if (isActive) {
          // sets the state with the retrieved data (this the a state, not a service call)
          setLoadedFollowStats({
            profileUid: followStatsProfileUid,
            viewerUid,
            stats: followStats,
          });
        }
      } catch (error) {
        if (isActive) {
          console.error('Failed to load profile follow statistics:', error);
          setFollowStatsError('Unable to load follow statistics. Please retry.');
        }
      } finally {
        if (isActive) {
          setIsLoadingFollowStats(false);
        }
      }
    }

    // loads the stats
    void loadFollowStats();

    return () => {
      // prevent invalid operations
      isActive = false;
    };
  // Re-runs the effect whenever the viewed profile, the current viewer,
  // or the retry counter changes. This ensures follow statistics are
  // loaded for the correct profile and viewer, and can be fetched again on retry.
  }, [followStatsProfileUid, viewerUid, followStatsRetry]); 


  // =====
  // DATA
  // =====

  // Determines if the profile is owned by the viewer user's uid.
  const isOwnProfile = profile !== null && viewerUid === profile.uid;

  // these are the current follow stats, based on the loaded ones in the useEffect.
  const currentFollowStats =
    profile &&
    loadedFollowStats?.profileUid === profile.uid &&
    loadedFollowStats.viewerUid === viewerUid
      ? loadedFollowStats.stats
      : null;

  // These are the current projects based on the loaded ones in the useEffect.
  const userProjects = firestoreProjects;


  // ==========
  // HANDLERS
  // ==========

  // Toggler for the follow button (follow/unfollow user)
  // calls userProfileService to set or unset the follow status in firestore
  async function handleFollowToggle() {
    if (
      !viewerUid ||
      !profile ||
      !currentFollowStats ||
      isOwnProfile ||
      isFollowSubmitting
    ) {
      return;
    }

    setIsFollowSubmitting(true);
    const shouldFollow = !currentFollowStats?.isFollowing;

    try {
      // userProfileService call
      await setFollowStatus(viewerUid, profile.uid, shouldFollow);

      // Update only the confirmed relationship state before refreshing counts.
      // sets the state with the retrieved data (this the state, not a service call)
      setLoadedFollowStats((previousStats) => {
        if (
          previousStats?.profileUid !== profile.uid ||
          previousStats.viewerUid !== viewerUid
        ) {
          return previousStats;
        }

        return {
          ...previousStats,
          stats: { ...previousStats.stats, isFollowing: shouldFollow },
        };
      });

      // Updates the follow stats (number of followers/following)
      try {
        const updatedStats = await getFollowStats(profile.uid, viewerUid);
        setLoadedFollowStats({
          profileUid: profile.uid,
          viewerUid,
          stats: updatedStats,
        });
        setFollowStatsError('');
      } catch (error) {
        console.error('Follow was saved, but statistics could not be refreshed:', error);
        setFollowStatsError(
          'Your follow was updated, but the statistics could not be refreshed. Showing the last available counts.'
        );
      }
    } catch {
      window.alert('Unable to update your follow. Please try again.');
    } finally {
      setIsFollowSubmitting(false);
    }
  }


  // Handler for the delete content button. Calls the services of the content
  // (artwork/sprite/projectService).
  // Deleting a content does not delete the subcollection of comments in this project.
  async function handleDeleteContent(contentType: 'artwork' | 'sprite' | 'project',
                                      contentId: string
                                    ): Promise<void> {

    if (!isOwnProfile) {
      return;
    }

    const contentNames = {
      artwork: 'artwork',
      sprite: 'sprite',
      project: 'project',
    };

    if (!window.confirm(`Delete this ${contentNames[contentType]}?`)) {
      return;
    }

    if (contentType === 'artwork') {
      try {
        // artworkService call
        await deleteArtworkById(contentId);

        // Remove the deleted artwork from this profile immediately.
        setUserArtworks((currentArtworks) =>
          currentArtworks.filter(
            (currentArtwork) => currentArtwork.id !== contentId
          )
        );
        setArtworkError('');
        setArtworkDeleteError('');
      } catch (error) {
        console.error('Failed to delete artwork:', error);
        setArtworkDeleteError(
          'Unable to delete this artwork. Please try again.'
        );
      }

    } else if (contentType === 'sprite') {

      try {
        // spriteService call
        await deleteSpriteById(contentId);

        // Remove the deleted sprite from this profile immediately.
        setUserSprites((currentSprites) =>
          currentSprites.filter(
            (currentSprite) => currentSprite.id !== contentId
          )
        );
        setSpriteError('');
        setSpriteDeleteError('');
      } catch (error) {
        console.error('Failed to delete sprite:', error);
        setSpriteDeleteError('Unable to delete this sprite. Please try again.');
      }

    } else { // projects

      try {
        // projectService call
        await deleteProjectById(contentId);

        // Remove the deleted project from this profile immediately.
        setFirestoreProjects((currentProjects) =>
          currentProjects.filter(
            (currentProject) => currentProject.id !== contentId
          )
        );
        setProjectError('');
        setProjectDeleteError('');
      } catch (error) {
        console.error('Failed to delete project:', error);
        setProjectDeleteError(
          'Unable to delete this project. Please try again.'
        );
      }
    }
  }


  // =================
  // PAGE RENDERINGS
  // =================

  if (isLoading) {
    return (
      <main className="main-content">
        <section className="discover">
          <p>Loading profile...</p>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="main-content">
        <section className="discover">
          <h1>Unable to load profile</h1>
          <p className="section-description">{loadError}</p>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="main-content">
        <section className="discover">
          <h1>Profile not found</h1>
          <p className="section-description">
            This user profile does not exist.
          </p>
          <Link to="/explore">Explore artwork</Link>
        </section>
      </main>
    );
  }


  // main ProfilePage rendering: shows display name, username, profile picture and banner,
  // follower stats and three sections for content (artwork, sprites and projects).
  // If the viewer owns the profile, there are the edit profile and upload/delete content functionalities.
  // If not, there will be only a follow button.
  return (
    <main className="main-content">
      <section className="profile">
        <div className="profile-banner">
          {profile.bannerUrl && (
            <img
              src={profile.bannerUrl}
              alt={`${profile.displayName}'s banner`}
            />
          )}
        </div>

        <div className="profile-header">
          <img
            className="profile-avatar"
            src={
              profile.profilePictureUrl ||
              'https://placehold.co/200x200?text=Pixeling'
            }
            alt={`${profile.displayName}'s profile picture`}
          />

          <div className="profile-identity">
            <h1>{profile.displayName}</h1>
            <p className="profile-username">@{profile.username}</p>
            <p className="profile-bio">{profile.bio}</p>

            <div
              className="profile-statistics"
              aria-label="Profile statistics"
            >
              <Link
                to={`/profile/${encodeURIComponent(profile.username)}/followers`}
                aria-label={`${currentFollowStats?.followerCount ?? 'Unavailable'} followers`}
              >
                <strong>
                  {currentFollowStats?.followerCount ??
                    (isLoadingFollowStats ? '…' : '—')}
                </strong>{' '}
                Followers
              </Link>
              <Link
                to={`/profile/${encodeURIComponent(profile.username)}/following`}
                aria-label={`${currentFollowStats?.followingCount ?? 'Unavailable'} following`}
              >
                <strong>
                  {currentFollowStats?.followingCount ??
                    (isLoadingFollowStats ? '…' : '—')}
                </strong>{' '}
                Following
              </Link>
            </div>
            {followStatsError && (
              <p className="section-description" role="alert">
                {followStatsError}{' '}
                <button
                  type="button"
                  onClick={() =>
                    setFollowStatsRetry((retryCount) => retryCount + 1)
                  }
                >
                  Retry
                </button>
              </p>
            )}
          </div>

          {isOwnProfile ? (
            <div className="profile-actions">
              <Link
                to={`/profile/${encodeURIComponent(profile.username)}/edit`}
                className="profile-action-button"
              >
                Edit Profile
              </Link>
            </div>
          ) : viewerUid ? (
            <div className="profile-actions">
              <button
                type="button"
                className="profile-action-button"
                aria-pressed={currentFollowStats?.isFollowing ?? false}
                disabled={isFollowSubmitting || !currentFollowStats}
                onClick={handleFollowToggle}
              >
                {isFollowSubmitting
                  ? 'Please wait...'
                  : !currentFollowStats
                    ? 'Follow status unavailable'
                    : currentFollowStats.isFollowing
                    ? 'Following'
                    : 'Follow'}
              </button>
            </div>
          ) : null}
        </div>

        {isOwnProfile && (
          <div className="create-menu-container">
            <button
              type="button"
              className="create-content-button"
              aria-label="Create new content"
              aria-expanded={isCreateMenuOpen}
              onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
            >
              +
            </button>

            {isCreateMenuOpen && (
              <div className="create-content-menu">
                <Link
                  to="/create/artwork"
                  onClick={() => setIsCreateMenuOpen(false)}
                >
                  Artwork
                </Link>
                <Link
                  to="/create/sprite"
                  onClick={() => setIsCreateMenuOpen(false)}
                >
                  Sprite
                </Link>
                <Link
                  to="/create/project"
                  onClick={() => setIsCreateMenuOpen(false)}
                >
                  Project
                </Link>
              </div>
            )}
          </div>
        )}

        <nav className="profile-tabs" aria-label="Profile content">
          <button
            type="button"
            className={activeTab === 'artworks' ? 'active' : ''}
            aria-pressed={activeTab === 'artworks'}
            onClick={() => setActiveTab('artworks')}
          >
            Artworks ({userArtworks.length})
          </button>

          <button
            type="button"
            className={activeTab === 'sprites' ? 'active' : ''}
            aria-pressed={activeTab === 'sprites'}
            onClick={() => setActiveTab('sprites')}
          >
            Sprites ({userSprites.length})
          </button>

          <button
            type="button"
            className={activeTab === 'projects' ? 'active' : ''}
            aria-pressed={activeTab === 'projects'}
            onClick={() => setActiveTab('projects')}
          >
            Projects ({userProjects.length})
          </button>
        </nav>

        <section className="profile-content">
          {activeTab === 'artworks' && (
            <>
              <h2>Artworks</h2>
              {artworkDeleteError && (
                <p className="section-description" role="alert">
                  {artworkDeleteError}
                </p>
              )}
              {isLoadingArtworks ||
              (!artworkError &&
                artworksLoadedForUid !== profile.uid) ? (
                <p className="section-description">Loading artworks...</p>
              ) : artworkError ? (
                <p className="section-description" role="alert">
                  {artworkError}
                </p>
              ) : userArtworks.length > 0 ? (
                <ArtworkGrid
                  artworks={userArtworks}
                  onDelete={
                    isOwnProfile
                      ? (id) => void handleDeleteContent('artwork', id)
                      : undefined
                  }
                />
              ) : (
                <p className="section-description">
                  This artist has not published any artworks yet.
                </p>
              )}
            </>
          )}

          {activeTab === 'sprites' && (
            <>
              <h2>Sprites</h2>
              {spriteDeleteError && (
                <p className="section-description" role="alert">
                  {spriteDeleteError}
                </p>
              )}
              {isLoadingSprites ||
              (!spriteError && spritesLoadedForUid !== profile.uid) ? (
                <p className="section-description">Loading sprites...</p>
              ) : spriteError ? (
                <p className="section-description" role="alert">
                  {spriteError}
                </p>
              ) : userSprites.length > 0 ? (
                <SpriteGrid
                  sprites={userSprites}
                  onDelete={
                    isOwnProfile
                      ? (id) => handleDeleteContent('sprite', id)
                      : undefined
                  }
                />
              ) : (
                <p className="section-description">
                  This artist has not published any sprites yet.
                </p>
              )}
            </>
          )}

          {activeTab === 'projects' && (
            <>
              <h2>Projects</h2>
              {projectDeleteError && (
                <p className="section-description" role="alert">
                  {projectDeleteError}
                </p>
              )}
              {isLoadingProjects ||
              (!projectError && projectsLoadedForUid !== profile.uid) ? (
                <p className="section-description">Loading projects...</p>
              ) : projectError ? (
                <p className="section-description" role="alert">
                  {projectError}
                </p>
              ) : userProjects.length > 0 ? (
                <ProjectGrid
                  projects={userProjects}
                  onDelete={
                    isOwnProfile
                      ? (id) => handleDeleteContent('project', id)
                      : undefined
                  }
                />
              ) : (
                <p className="section-description">
                  This artist has not published any projects yet.
                </p>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}

export default ProfilePage;
