/**
 * Allows the authenticated user to edit their Firestore profile.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ChangeEvent, SubmitEvent } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { updateCurrentUserDisplayName } from '../services/authService';
import {
  getUserProfileByUid,
  updateUserProfile,
} from '../services/userProfileService';
import type { UserProfile } from '../types/UserProfile';
import '../app/CreateContent.css';

const MAX_PROFILE_IMAGE_SIZE = 50 * 1024;

function EditProfilePage() {
  // Used to navigate to the user's profile after it submits the form
  const navigate = useNavigate();

  // Listens to the authentication context
  const authState = useAuth();
  const currentUser = authState.user;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [profilePictureError, setProfilePictureError] = useState('');
  const [bannerError, setBannerError] = useState('');

  // Load the authenticated user's profile from Firestore.
  // Calls the userProfileService
  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      if (!currentUser) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        // userProfileService call: gets a user by their UID from firestore
        const loadedProfile = await getUserProfileByUid(currentUser.uid);

        if (!isActive) {
          return;
        }

        setProfile(loadedProfile);

        if (loadedProfile) {
          // changes the states with the user's info
          setDisplayName(loadedProfile.displayName);
          setBio(loadedProfile.bio);
          setProfilePictureUrl(loadedProfile.profilePictureUrl);
          setBannerUrl(loadedProfile.bannerUrl);
        }
      } catch {
        if (isActive) {
          setErrorMessage('Unable to load your profile. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    // Loads the profile with the defined function
    void loadProfile();

    return () => {
      // prevents invalid operations after the component is unmounted
      isActive = false;
    };
  }, [currentUser?.uid]);


  // handler used in the input of the form where the user selects a new profile picture and/or banner.
  // Validate each selected image before reading it; invalid files leave the current preview unchanged.
  function handleImageChange(event: ChangeEvent<HTMLInputElement>,
                            setImageUrl: (imageUrl: string) => void,
                            setImageError: (message: string) => void  ) {

    const selectedFile = event.target.files?.[0];
    setImageError('');

    if (!selectedFile) {
      return;
    }

    // File must be png, jpg or jpeg, and under 50 KB
    const fileName = selectedFile.name.toLowerCase();
    const expectedMimeType = fileName.endsWith('.png')
      ? 'image/png'
      : fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')
        ? 'image/jpeg'
        : '';
    const hasMatchingMimeType =
      !selectedFile.type || selectedFile.type === expectedMimeType;

    if (!expectedMimeType || !hasMatchingMimeType) {
      setImageError('Please select a JPG, JPEG, or PNG image.');
      event.target.value = '';
      return;
    }

    if (selectedFile.size > MAX_PROFILE_IMAGE_SIZE) {
      setImageError(
        'Each profile image must be 50 KB or smaller. Please choose a smaller file.'
      );
      event.target.value = '';
      return;
    }

    // Starts reading the file
    const fileReader = new FileReader();

    fileReader.onload = () => {
      if (typeof fileReader.result === 'string') {
        setImageUrl(fileReader.result);
      } else {
        setImageError('Unable to read this image. Please try again.');
      }
    };

    fileReader.onerror = () => {
      setImageError('Unable to read this image. Please try again.');
    };

    fileReader.readAsDataURL(selectedFile);
  }


  // This is the submit function executed at the submit of the form
  // Updates the user profile's data with the data from the form
  // Calls the userProfileService to update the firestore profile
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser || !profile || isSaving) {
      return;
    }

    const trimmedDisplayName = displayName.trim();

    if (!trimmedDisplayName) {
      setErrorMessage('Display name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      // Calls userProfileService.
      // Firestore is the public profile source of truth; handle its failure separately.
      await updateUserProfile(currentUser.uid, {
        displayName: trimmedDisplayName,
        bio: bio.trim(),
        profilePictureUrl,
        bannerUrl,
      });
    } catch (error) {
      console.error('Failed to save the Firestore profile:', error);
      setErrorMessage('Unable to save your profile. Please try again.');
      setIsSaving(false);
      return;
    }

    try {
      // Calls the userProfileService to update the display name of the profile.
      // Keep the Firebase account display name in sync after the public profile is saved.
      await updateCurrentUserDisplayName(trimmedDisplayName);
      // Navigates back to the profile page
      navigate(`/profile/${encodeURIComponent(profile.username)}`);
    } catch (error) {
      console.error('The profile was saved, but the Auth display name update failed:', error);
      setErrorMessage(
        'Your profile was saved, but your account display name may not have been updated. Please try saving again.'
      );
    } finally {
      setIsSaving(false);
    }
  }


  
  if (isLoading) {
    return (
      <main className="main-content">
        <section className="create-content-page">
          <p>Loading your profile...</p>
        </section>
      </main>
    );
  }

  if (!currentUser || !profile) {
    return (
      <main className="main-content">
        <section className="create-content-page">
          <h1>Profile not found</h1>
          <p className="section-description">
            Your profile could not be found. Please sign in with an account
            that has a Pixeling profile.
          </p>
          {errorMessage && (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          )}
          <button
            className="secondary-button"
            type="button"
            onClick={() => navigate(currentUser ? '/explore' : '/login')}
          >
            {currentUser ? 'Explore artwork' : 'Log in'}
          </button>
        </section>
      </main>
    );
  }


  // Profile edit page loaded successfully
  return (
    <main className="main-content">
      <section className="create-content-page">
        <h1>Edit Profile</h1>
        <p className="section-description">
          Update how you appear to the Pixeling community.
        </p>

        <form className="create-content-form" onSubmit={handleSubmit}>
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={50}
            required
          />

          <label htmlFor="profile-bio">Bio</label>
          <textarea
            id="profile-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={4}
            maxLength={300}
            placeholder="Tell the community about yourself"
          />

          <label htmlFor="profile-picture">Profile picture</label>
          <input
            id="profile-picture"
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            onChange={(event) =>
              handleImageChange(
                event,
                setProfilePictureUrl,
                setProfilePictureError
              )
            }
          />

          {profilePictureError && (
            <p className="auth-error" role="alert">
              {profilePictureError}
            </p>
          )}

          {profilePictureUrl && (
            <div className="create-content-preview">
              <img
                src={profilePictureUrl}
                alt="Profile picture preview"
              />
            </div>
          )}

          <label htmlFor="profile-banner">Profile banner</label>
          <input
            id="profile-banner"
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            onChange={(event) =>
              handleImageChange(event, setBannerUrl, setBannerError)
            }
          />

          {bannerError && (
            <p className="auth-error" role="alert">
              {bannerError}
            </p>
          )}

          {bannerUrl && (
            <div className="create-content-preview">
              <img src={bannerUrl} alt="Profile banner preview" />
            </div>
          )}

          {errorMessage && (
            <p className="auth-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="create-content-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving}
              onClick={() =>
                navigate(`/profile/${encodeURIComponent(profile.username)}`)
              }
            >
              Cancel
            </button>

            <button
              className="primary-button"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default EditProfilePage;
