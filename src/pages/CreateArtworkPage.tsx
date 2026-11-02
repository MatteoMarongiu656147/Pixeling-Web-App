
/**
 * Provides a form for publishing artwork to Firestore.
 * Artwork images are stored as Data URLs to avoid Firebase Storage.
 */
import { useEffect, useState } from 'react';
import type { ChangeEvent, SubmitEvent } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '../contexts/AuthContext';
import { getUserProfileByUid } from '../services/userProfileService';
import { createArtwork } from '../services/artworkService';

import type { UserProfile } from '../types/UserProfile';

import '../app/CreateContent.css';

const MAX_IMAGE_SIZE = 100 * 1024;

function CreateArtworkPage() {
  // used to navigate to the user's profile after uploading a content
  const navigate = useNavigate();

  // Listens to the authentication context
  const authState = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [isReadingImage, setIsReadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [imageErrorMessage, setImageErrorMessage] = useState('');

  // Load the real Firestore profile for the signed-in account.
  // This is done because when the artwork is created, the data must also save some 
  // information about the author (see createArtwork in artworkService)
  useEffect(() => {
    let isActive = true;

    async function loadProfile() {

      // Wait for it to finish loading. When isLoading changes, the useEffect will be executed again.
      if (authState.isLoading) {
        return;
      }

      if (!authState.user) {
        setProfile(null);
        setErrorMessage('Please sign in to publish artwork.');
        return;
      }

      try {

        // calls the userProfileService to get the user by UID
        const userProfile = await getUserProfileByUid(authState.user.uid);

        if (isActive) {
          setProfile(userProfile);

          if (!userProfile) {
            setErrorMessage(
              'Your user profile could not be found. Please complete your profile first.'
            );
          } else {
            setErrorMessage('');
          }
        }
      } catch {
        if (isActive) {
          setErrorMessage('Unable to load your profile. Please try again.');
        }
      }
    }

    // calls the defined function and loads the user's profile from firestore
    void loadProfile();

    return () => {
      // prevent invalid operations when the component is unmounted
      isActive = false;
    };
  }, [authState.isLoading, authState.user]); // executed every time the auth loading state or the user changes

  // This function is executed onChange in the input of type "file" where the user selects a file
  // for his new content.
  // Validates the file before reading it, keeps the last valid preview if selection fails.
  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {

    const selectedFile = event.target.files?.[0];

    setImageErrorMessage('');
    setErrorMessage('');

    if (!selectedFile) {
      return;
    }

    // Consistency check: file must be a png or a jpg, and under 100 KiB.
    // On inconsistency, shows a message regarding the error to inform the user.
    const fileName = selectedFile.name.toLowerCase();
    const expectedMimeType = fileName.endsWith('.png')
      ? 'image/png'
      : fileName.endsWith('.jpg')
        ? 'image/jpeg'
        : '';
    const hasSupportedExtension = expectedMimeType !== '';
    const hasMatchingMimeType =
      !selectedFile.type || selectedFile.type === expectedMimeType;

    if (!hasSupportedExtension || !hasMatchingMimeType) {
      setImageErrorMessage('Please select a .png or .jpg image file.');
      event.target.value = '';
      return;
    }

    if (selectedFile.size > MAX_IMAGE_SIZE) {
      setImageErrorMessage(
        'The image must be 100 KiB or smaller. Please resize it and try again.'
      );
      event.target.value = '';
      return;
    }

    // Consistency checks are successful; starts reading the file
    setIsReadingImage(true);

    // Starts loading the file
    const fileReader = new FileReader();

    fileReader.onload = () => {
      if (typeof fileReader.result === 'string') {
        setImageDataUrl(fileReader.result);
        setImageName(selectedFile.name);
        setImageErrorMessage('');
      } else {
        setImageErrorMessage('Unable to read this image file.');
      }

      setIsReadingImage(false);
    };

    fileReader.onerror = () => {
      setImageErrorMessage('Unable to read this image file.');
      setIsReadingImage(false);
    };

    // Reads the data as URL, because Firestore can't store files like Firebase Cloud Storage.
    // This explains why we dont' want files that are too large, as firestore documents can
    // only reach up to 1 MiB.
    fileReader.readAsDataURL(selectedFile);
  }

  // Submit function executed in the form on submit. Creates the new artwork with the data
  // provided by the user in the form by calling the artworkService, which also adds it to firestore.
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {

    event.preventDefault();
    setErrorMessage('');

    if (authState.isLoading || !authState.user) {
      setErrorMessage('Please sign in to publish artwork.');
      return;
    }

    if (!profile) {
      setErrorMessage('Your user profile is not available.');
      return;
    }

    // You can't publish a content without any file
    if (!imageDataUrl || isReadingImage) {
      setErrorMessage('Please select an image and wait for it to load.');
      return;
    }

    setIsSaving(true);

    try {

      // The tags state is updated in the input where the user can write the tags.
      // The user can write multiple tags by separating them with a ',' (e.g. nature, landscape, waterfall).
      const artworkTags = tags
        .split(',')
        .map((currentTag) => currentTag.trim())
        .filter((currentTag) => currentTag.length > 0);

      // calls the function from artworkService: creates a new artwork
      // and adds it to the collection of artworks in firestore
      await createArtwork({
        title: title.trim(),
        description: description.trim(),
        artistUid: authState.user.uid,
        artistUsername: profile.username,
        tags: artworkTags,
        imageDataUrl,
      });

      // Navigate to the creator's profile page after publishing.
      navigate(
        `/profile/${encodeURIComponent(profile.username)}`
      );

    } catch (error) {
      console.error('Unable to publish artwork:', error);
      setErrorMessage(
        'Unable to publish your artwork. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  
  // Executed by the cancel button, navigates back to the user's profile
  // without publishing anything
  function handleCancel() {
    if (profile) {
      navigate(
        `/profile/${encodeURIComponent(profile.username)}`
      );
    } else {
      navigate('/home');
    }
  }

  // Used to disable the submit button in the form if one of these conditions is true
  const isSubmitDisabled =
    authState.isLoading ||
    !authState.user ||
    !profile ||
    isReadingImage ||
    isSaving;

  return (
    <main className="main-content">
      <section className="create-content-page">
        <h1>Create an Artwork</h1>

        <p className="section-description">
          Share your pixel art with the Pixeling community.
        </p>

        {errorMessage && (
          <p role="alert" className="form-error">
            {errorMessage}
          </p>
        )}

        <form
          className="create-content-form"
          onSubmit={handleSubmit}
        >
          <label htmlFor="artwork-title">Title</label>
          <input
            id="artwork-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Give your artwork a title"
            required
          />

          <label htmlFor="artwork-description">
            Description
          </label>
          <textarea
            id="artwork-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Tell us about your artwork"
            rows={4}
          />

          <label htmlFor="artwork-image">Artwork image</label>
          <input
            id="artwork-image"
            type="file"
            accept=".png,.jpg,image/png,image/jpeg"
            onChange={handleImageChange}
          />

          <p className="form-hint">
            Only PNG and JPG images up to 100 KiB are accepted.
          </p>

          {imageErrorMessage && (
            <p role="alert" className="form-error">
              {imageErrorMessage}
            </p>
          )}

          {isReadingImage && <p>Reading image...</p>}

          {imageName && (
            <p className="form-hint">
              Selected image: {imageName}
            </p>
          )}

          {imageDataUrl && (
            <div className="create-content-preview">
              <img
                src={imageDataUrl}
                alt="Artwork preview"
              />
            </div>
          )}

          <label htmlFor="artwork-tags">Tags</label>
          <input
            id="artwork-tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="nature, fantasy, pixel-art"
          />

          <p className="form-hint">
            Separate tags with commas.
          </p>

          <div className="create-content-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </button>

            <button
              className="primary-button"
              type="submit"
              disabled={isSubmitDisabled}
            >
              {isSaving ? 'Publishing...' : 'Publish Artwork'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CreateArtworkPage;
