/** 
 * Displays the real profiles connected to a user's Firestore follow list. 
 * Used both for the followed users and the followers users.
 **/

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import {
  getFollowerProfiles,
  getFollowingProfiles,
  getUserProfileByUsername,
} from '../../services/userProfileService';
import type { UserProfile } from '../../types/UserProfile';

type FollowListKind = 'following' | 'followers';

// This type is the type of the state (result), see line 38
type FollowListResult = {
  username: string; // username to which the results refer
  status: 'success' | 'not-found' | 'error'; // status of the result loading attempt
  profile?: UserProfile; // profile of the user
  profiles: UserProfile[]; // Array of profiles of followers or users being followed
};

// The listKind in the props can be followers, or following users.
// e.g. <FollowProfilesListPage listKind="followers" /> shows the page with the followers of a user.
type FollowProfilesListPageProps = {
  listKind: FollowListKind;
};

function FollowProfilesListPage(props: FollowProfilesListPageProps) {

  // useParams is needed because the page redirects through dinamic URLs.
  // The dinamic parameter is the username
  const routeParams = useParams();
  const username = routeParams.username;

  const [result, setResult] = useState<FollowListResult | null>(null);

  // The username follows the existing profile URL; Firestore relationships use its UID.

  useEffect(() => {
    
    let isActive = true;

    async function loadProfiles() {

      // if there is no username in the dynamic URL parameters, returns immediately
      if (!username) {
        setResult(null);
        return;
      }

      try {

        // calls the userProfileService and tries to get the user profile by username
        const profile = await getUserProfileByUsername(username);

        // Profile not found: sets the result's status as not-found and the array of profiles
        // (followers/following) as empty, then returns.
        if (!profile) {
          if (isActive) {
            setResult({ username, status: 'not-found', profiles: [] });
          }
          return;
        }

        // builds the array of profiles by calling the userProfileService's functions.
        // The list will contain followers or following users depending on listKind.
        const profiles =
          props.listKind === 'following'
            ? await getFollowingProfiles(profile.uid)
            : await getFollowerProfiles(profile.uid);

        // Success or error
        if (isActive) {
          setResult({ username, status: 'success', profile, profiles });
        }
      } catch (error) {
        console.error(`Unable to load ${props.listKind} profiles:`, error);
        if (isActive) {
          setResult({ username, status: 'error', profiles: [] });
        }
      }
    }

    // calls the function
    void loadProfiles();

    // cleanup
    return () => {
      isActive = false;
    };
  }, [username, props.listKind]); // executed each time the liskKind or the dynamic URL username parameter changes

  const isCurrentResult = result?.username === username;
  const title = props.listKind === 'following' ? 'Following' : 'Followers';

  // -------------------------------------------------------------------------------

  // the page is still loading
  if (!username || !result || !isCurrentResult) {
    return (
      <main className="main-content">
        <section className="discover">
          <h1>{title}</h1>
          <p className="section-description">Loading profiles...</p>
        </section>
      </main>
    );
  }

  // the user's profile was not found
  if (result.status === 'not-found') {
    return (
      <main className="main-content">
        <section className="discover">
          <h1>Profile not found</h1>
          <p className="section-description">
            This user profile does not exist.
          </p>
          <Link to="/explore">Explore Pixeling</Link>
        </section>
      </main>
    );
  }

  // there is a loading error or the result doesn't have a valid user profile
  if (result.status === 'error' || !result.profile) {
    return (
      <main className="main-content">
        <section className="discover">
          <h1>Unable to load {title.toLowerCase()}</h1>
          <p className="section-description" role="alert">
            Unable to load profiles. Please try again.
          </p>
        </section>
      </main>
    );
  }

  // -----------------------------------------------------------------------------------

  const profile = result.profile;
  const emptyMessage =
    props.listKind === 'following'
      ? `@${profile.username} is not following anyone yet.`
      : `@${profile.username} does not have any followers yet.`;

  return (
    <main className="main-content">
      <section className="discover">
        <header className="page-header">
          <h1>{title}</h1>
          <p className="section-description">
            {title} for{' '}
            <Link to={`/profile/${encodeURIComponent(profile.username)}`}>
              @{profile.username}
            </Link>
          </p>
        </header>

        {result.profiles.length === 0 ? (
          <p className="section-description">{emptyMessage}</p>
        ) : (
          <div className="search-user-list">
            {result.profiles.map((currentProfile) => (
              <Link
                className="search-user"
                key={currentProfile.uid}
                to={`/profile/${encodeURIComponent(currentProfile.username)}`}
              >
                <img
                  src={
                    currentProfile.profilePictureUrl ||
                    'https://placehold.co/200x200?text=Pixeling'
                  }
                  alt=""
                />
                <div>
                  <h4>{currentProfile.displayName}</h4>
                  <p>@{currentProfile.username}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default FollowProfilesListPage;
