/** Displays the form for publishing static or animated sprites to Firestore. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ChangeEvent, SubmitEvent } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { getUserProfileByUid } from '../services/userProfileService';
import { createSprite } from '../services/spriteService';
import type { UserProfile } from '../types/UserProfile';
import '../app/CreateContent.css';

// A union type restricts the sprite type to these two valid values.
type SpriteCreationType = 'static' | 'animated';

const MAX_SPRITE_SIZE = 50 * 1024;

function CreateSpritePage() {
  // used to navigate to the user's profile after uploading a content
  const navigate = useNavigate();

  // Listens to the authentication context
  const authState = useAuth();

  // Store the selected sprite type and the text fields.
  const [spriteType, setSpriteType] = useState<SpriteCreationType>('static');
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isReadingImage, setIsReadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [imageErrorMessage, setImageErrorMessage] = useState('');

  // Load the authenticated user's public profile to save its username with the sprite.
  // This is done because when the sprite is created, the data must also save some 
  // information about the author (see createSprite in spriteService)
  useEffect(() => {
    let isActive = true;

    // Wait for it to finish loading. When isLoading changes, the useEffect will be executed again.
    async function loadProfile() {
      if (authState.isLoading) {
        return;
      }

      if (!authState.user) {
        setProfile(null);
        setErrorMessage('Please sign in to publish a sprite.');
        setIsLoadingProfile(false);
        return;
      }

      setIsLoadingProfile(true);

      try {
        // calls the userProfileService to get the user by UID
        const userProfile = await getUserProfileByUid(authState.user.uid);

        if (isActive) {
          setProfile(userProfile);
          setErrorMessage(
            userProfile
              ? ''
              : 'Your user profile could not be found. Please complete your profile first.'
          );
        }
      } catch (error) {
        if (isActive) {
          console.error('Unable to load the sprite creator profile:', error);
          setErrorMessage('Unable to load your profile. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoadingProfile(false);
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


  // This function is executed in the first input in the form, where the user
  // selects the type of sprite he wants to upload (static or animated)
  function handleSpriteTypeChange(nextType: SpriteCreationType) {
    setSpriteType(nextType);

    // Clear the previous image because each sprite type has a different file format.
    setImageDataUrl('');
    setImageName('');
    setImageErrorMessage('');
  }

  // This function is executed in the input where the user selects the file.
  // Validates the file before reading it, keeping the last valid preview if selection fails.
  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    setImageErrorMessage('');
    setErrorMessage('');

    if (!selectedFile) {
      return;
    }

    // Must be a gif, png or jpg no greater than 50 KiB.
    const fileName = selectedFile.name.toLowerCase();
    const expectedMimeType =
      spriteType === 'animated'
        ? fileName.endsWith('.gif')
          ? 'image/gif'
          : ''
        : fileName.endsWith('.png')
          ? 'image/png'
          : fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')
            ? 'image/jpeg'
            : '';
    const hasSupportedExtension = expectedMimeType !== '';
    const hasMatchingMimeType =
      !selectedFile.type || selectedFile.type === expectedMimeType;

    if (!hasSupportedExtension || !hasMatchingMimeType) {
      setImageErrorMessage(
        spriteType === 'animated'
          ? 'Please select a .gif animation. Only GIF files are supported for animated sprites.'
          : 'Please select a .jpg, .jpeg, or .png image. Other formats are not supported for static sprites.'
      );
      event.target.value = '';
      return;
    }

    if (selectedFile.size > MAX_SPRITE_SIZE) {
      setImageErrorMessage(
        'The sprite file must be 50 KB or smaller. Please resize it and try again.'
      );
      event.target.value = '';
      return;
    }

    setIsReadingImage(true);

    // Starts loading the file
    const fileReader = new FileReader();

    fileReader.onload = () => {
      if (
        typeof fileReader.result === 'string' &&
        fileReader.result.startsWith(
          `data:${expectedMimeType};base64,`
        )
      ) {
        setImageDataUrl(fileReader.result);
        setImageName(selectedFile.name);
        setImageErrorMessage('');
      } else {
        setImageErrorMessage(
          spriteType === 'animated'
            ? 'Unable to read this GIF file.'
            : 'Unable to read this JPG or PNG image file.'
        );
      }

      setIsReadingImage(false);
    };

    fileReader.onerror = () => {
      setImageErrorMessage('Unable to read this image file. Please try again.');
      setIsReadingImage(false);
    };

    // Reads the data as URL, because Firestore can't store files like Firebase Cloud Storage.
    // This explains why we dont' want files that are too large, as firestore documents can
    // only reach up to 1 MiB.
    fileReader.readAsDataURL(selectedFile);
  }

  // Executed at the submit of the form. Calls the spriteService to create and upload
  // a new sprite on firestore with the data from the form.
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setErrorMessage('');

    if (authState.isLoading || !authState.user) {
      setErrorMessage('Please sign in to publish a sprite.');
      return;
    }

    if (!profile) {
      setErrorMessage('Your user profile is not available.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Please enter a title for your sprite.');
      return;
    }

    if (!imageDataUrl || isReadingImage) {
      setErrorMessage(
        spriteType === 'animated'
          ? 'Please select a GIF file and wait for it to load.'
          : 'Please select a JPG or PNG image and wait for it to load.'
      );
      return;
    }

    setIsSaving(true);

    try {

      // The tags state is updated in the input where the user can write the tags.
      // The user can write multiple tags by separating them with a ',' (e.g. nature, landscape, waterfall).
      const spriteTags = tags
        .split(',')
        .map((currentTag) => currentTag.trim())
        .filter((currentTag) => currentTag.length > 0);

      // Builds the data of the sprite
      const spriteData = {
        title: title.trim(),
        description: description.trim(),
        artistUid: authState.user.uid,
        artistUsername: profile.username,
        tags: spriteTags,
      };

      // Calls the spriteService to create and add a new sprite on firestore with the collected data.
      // Keeps the image field aligned with the selected static or animated type.
      if (spriteType === 'animated') {
        await createSprite({
          ...spriteData,
          type: 'animated',
          animationUrl: imageDataUrl,
        });
      } else {
        await createSprite({
          ...spriteData,
          type: 'static',
          previewUrl: imageDataUrl,
        });
      }

      // Navigates to the profile page after the submit is successful.
      navigate(`/profile/${encodeURIComponent(profile.username)}`);
    } catch (error) {
      console.error('Unable to publish sprite:', error);
      setErrorMessage('Unable to publish your sprite. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  
  // Used by the cancel button, navigates back to the profile page.
  function handleCancel() {
    if (profile) {
      navigate(`/profile/${encodeURIComponent(profile.username)}`);
    } else {
      navigate('/home');
    }
  }

  // Used to disable the submit button in the form if one of these conditions is true
  const isSubmitDisabled =
    authState.isLoading ||
    isLoadingProfile ||
    !authState.user ||
    !profile ||
    isReadingImage ||
    isSaving;

  return (
    <main className="main-content">
      <section className="create-content-page">
        <h1>Create a Sprite</h1>
        <p className="section-description">
          Share a static or animated sprite with the Pixeling community.
        </p>

        {errorMessage && (
          <p role="alert" className="form-error">
            {errorMessage}
          </p>
        )}

        {(authState.isLoading || isLoadingProfile) && (
          <p>Loading your profile...</p>
        )}

        <form className="create-content-form" onSubmit={handleSubmit}>
          <label htmlFor="sprite-type">Sprite type</label>
          <select
            id="sprite-type"
            value={spriteType}
            onChange={(event) =>
              handleSpriteTypeChange(
                event.target.value === 'animated' ? 'animated' : 'static'
              )
            }
            disabled={isReadingImage || isSaving}
          >
            <option value="static">Static Sprite</option>
            <option value="animated">Animated Sprite</option>
          </select>

          <label htmlFor="sprite-title">Title</label>
          <input
            id="sprite-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Give your sprite a title"
            required
          />

          <label htmlFor="sprite-description">Description</label>
          <textarea
            id="sprite-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe your sprite"
            rows={4}
          />

          <label htmlFor="sprite-file">
            {spriteType === 'static' ? 'Sprite image' : 'Animation file'}
          </label>
          <input
            id="sprite-file"
            key={spriteType}
            type="file"
            accept={spriteType === 'animated'
              ? '.gif,image/gif'
              : '.jpg,.jpeg,.png,image/jpeg,image/png'}
            onChange={handleImageChange}
            disabled={isReadingImage || isSaving}
          />
          <p className="form-hint">
            {spriteType === 'animated'
              ? 'Animated sprites must be GIF files no larger than 50 KB.'
              : 'Static sprites must be JPG or PNG images no larger than 50 KB.'}
          </p>

          {imageErrorMessage && (
            <p role="alert" className="form-error">
              {imageErrorMessage}
            </p>
          )}

          {isReadingImage && <p>Reading image...</p>}

          {imageName && (
            <p className="form-hint">Selected file: {imageName}</p>
          )}

          {imageDataUrl && (
            <div className="create-content-preview">
              <img
                src={imageDataUrl}
                alt={
                  spriteType === 'animated'
                    ? 'Animated sprite preview'
                    : 'Sprite preview'
                }
              />
            </div>
          )}

          <label htmlFor="sprite-tags">Tags</label>
          <input
            id="sprite-tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="character, fantasy, animation"
          />
          <p className="form-hint">Separate tags with commas.</p>

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
              {isSaving ? 'Publishing...' : 'Publish Sprite'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CreateSpritePage;
