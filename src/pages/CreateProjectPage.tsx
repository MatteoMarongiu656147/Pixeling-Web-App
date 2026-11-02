/** Displays the form for saving a preview and original Aseprite file to Firestore. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ChangeEvent, SubmitEvent } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { getUserProfileByUid } from '../services/userProfileService';
import { createProject } from '../services/projectService';
import type { UserProfile } from '../types/UserProfile';
import '../app/CreateContent.css';

const MAX_PREVIEW_SIZE = 50 * 1024;
const MAX_PROJECT_FILE_SIZE = 10 * 1024;

function CreateProjectPage() {
  // used to navigate to the user's profile after uploading a content
  const navigate = useNavigate();

  // Listens to the authentication context
  const authState = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [previewDataUrl, setPreviewDataUrl] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');
  const [projectFileData, setProjectFileData] = useState('');
  const [projectFileName, setProjectFileName] = useState('');
  const [projectFileSize, setProjectFileSize] = useState(0);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isReadingPreview, setIsReadingPreview] = useState(false);
  const [isReadingProjectFile, setIsReadingProjectFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load the real Firestore profile for the signed-in account.
  // This is done because when the project is created, the data must also save some 
  // information about the author (see createProject in projectService)
  useEffect(() => {

    let isActive = true;

    async function loadProfile() {

      if (authState.isLoading) {
        return;
      }

      if (!authState.user) {
        setProfile(null);
        setErrorMessage('Please sign in to publish a project.');
        setIsLoadingProfile(false);
        return;
      }

      setIsLoadingProfile(true);

      try {
        // calls the userProfileService to get the user by UID
        const loadedProfile = await getUserProfileByUid(authState.user.uid);

        if (isActive) {
          setProfile(loadedProfile);
          setErrorMessage(
            loadedProfile
              ? ''
              : 'Your user profile could not be found. Please complete your profile first.'
          );
        }
      } catch (error) {
        if (isActive) {
          console.error('Unable to load the project creator profile:', error);
          setErrorMessage('Unable to load your profile. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoadingProfile(false);
        }
      }
    }

    // calls the defined function to get the user's data
    void loadProfile();

    return () => {
      // prevent invalid operations when the component is unmounted
      isActive = false;
    };
  }, [authState.isLoading, authState.user]); // executed when the auth loading state or the user change


  // Validates the image preview file before reading it as a Data URL for Firestore.
  // Used in the input to set the project's preview image in the form.
  async function handlePreviewChange(event: ChangeEvent<HTMLInputElement>) {

    const selectedFile = event.target.files?.[0];
    setPreviewDataUrl('');
    setPreviewFileName('');
    setErrorMessage('');

    if (!selectedFile) {
      return;
    }

    // Consistency check: must be a png/jpg file no greater than 50 KiB.
    const fileName = selectedFile.name.toLowerCase();
    const expectedMimeType = fileName.endsWith('.png')
      ? 'image/png'
      : fileName.endsWith('.jpg')
        ? 'image/jpeg'
        : '';
    const hasMatchingMimeType =
      !selectedFile.type || selectedFile.type === expectedMimeType;

    if (!expectedMimeType || !hasMatchingMimeType) {
      setErrorMessage('Please select a .jpg or .png preview image.');
      event.target.value = '';
      return;
    }

    if (selectedFile.size > MAX_PREVIEW_SIZE) {
      setErrorMessage('The preview image must be 50 KB or smaller.');
      event.target.value = '';
      return;
    }

    setIsReadingPreview(true);

    try {
      // reads the file as URL (Base64 encoding), see the utility functions below the component.
      const dataUrl = await readFileAsDataUrl(selectedFile);

      if (!dataUrl.startsWith(`data:${expectedMimeType};base64,`)) {
        throw new Error('The selected preview is not a valid JPG or PNG image.');
      }

      setPreviewDataUrl(dataUrl);
      setPreviewFileName(selectedFile.name);
    } catch (error) {
      console.error('Unable to read the project preview:', error);
      setErrorMessage('Unable to read the preview image. Please try again.');
    } finally {
      setIsReadingPreview(false);
    }
  }

  // Validates the aseprite project file before reading it as a Data URL for Firestore.
  // Used in the input to set the project's aseprite file in the form.
  async function handleProjectFileChange(event: ChangeEvent<HTMLInputElement>) {

    const selectedFile = event.target.files?.[0];
    setProjectFileData('');
    setProjectFileName('');
    setProjectFileSize(0);
    setErrorMessage('');

    if (!selectedFile) {
      return;
    }

    // Consistency check: must be a .aseprite file no greater than 10 KiB.
    if (!selectedFile.name.toLowerCase().endsWith('.aseprite')) {
      setErrorMessage('Please select a file with the .aseprite extension.');
      event.target.value = '';
      return;
    }

    if (selectedFile.size > MAX_PROJECT_FILE_SIZE) {
      setErrorMessage('The .aseprite file must be 10 KB or smaller.');
      event.target.value = '';
      return;
    }

    if (selectedFile.size === 0) {
      setErrorMessage('The .aseprite file cannot be empty.');
      event.target.value = '';
      return;
    }

    setIsReadingProjectFile(true);

    try {

      const originalBytes = await selectedFile.arrayBuffer();
      // See utility functions below the component
      const encodedFileData = arrayBufferToBase64(originalBytes);

      setProjectFileData(encodedFileData);
      setProjectFileName(selectedFile.name);
      setProjectFileSize(selectedFile.size);
    } catch (error) {
      console.error('Unable to read the original project file:', error);
      setErrorMessage('Unable to read the .aseprite file. Please try again.');
    } finally {
      setIsReadingProjectFile(false);
    }
  }


  // handles the submit of the form: on submit, it will create a new project
  // and upload it to firestore by calling the function from projectService.
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {

    event.preventDefault();

    if (isSaving) {
      return;
    }

    setErrorMessage('');

    if (authState.isLoading || !authState.user) {
      setErrorMessage('Please sign in to publish a project.');
      return;
    }

    if (!profile) {
      setErrorMessage('Your user profile is not available.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Please enter a title for your project.');
      return;
    }

    if (!previewDataUrl || isReadingPreview) {
      setErrorMessage('Please select a valid JPG or PNG preview image.');
      return;
    }

    if (!projectFileData || !projectFileName || isReadingProjectFile) {
      setErrorMessage('Please select a valid .aseprite file and wait for it to load.');
      return;
    }

    setIsSaving(true);

    try {

      // The tags state is updated in the input where the user can write the tags.
      // The user can write multiple tags by separating them with a ',' (e.g. nature, landscape, waterfall).
      const projectTags = tags
        .split(',')
        .map((currentTag) => currentTag.trim())
        .filter((currentTag) => currentTag.length > 0);

      // calls the function from projectService: creates a new artwork
      // and adds it to the collection of projects in firestore
      await createProject({
        title: title.trim(),
        description: description.trim(),
        artistUid: authState.user.uid,
        artistUsername: profile.username,
        tags: projectTags,
        previewUrl: previewDataUrl,
        projectFileData,
        fileName: projectFileName,
        fileSizeBytes: projectFileSize,
        mimeType: 'application/octet-stream',
      });

      window.alert('Project published successfully!');
      navigate(`/profile/${encodeURIComponent(profile.username)}`);
    } catch (error) {
      console.error('Unable to publish project:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to publish your project. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  }


  // Used in the cancel button, navigates back to the profile page
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
    isReadingPreview ||
    isReadingProjectFile ||
    isSaving;

  return (
    <main className="main-content">
      <section className="create-content-page">
        <h1>Create a Project</h1>
        <p className="section-description">
          Share a project and its downloadable Aseprite file.
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
          <label htmlFor="project-title">Title</label>
          <input
            id="project-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Give your project a title"
            required
          />

          <label htmlFor="project-description">Description</label>
          <textarea
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe your project"
            rows={4}
          />

          <label htmlFor="project-preview">Preview image</label>
          <input
            id="project-preview"
            type="file"
            accept=".jpg,.png,image/jpeg,image/png"
            onChange={(event) => void handlePreviewChange(event)}
            disabled={isReadingPreview || isSaving}
            required
          />
          <p className="form-hint">
            Preview images must be JPG or PNG files no larger than 50 KB.
          </p>

          {isReadingPreview && <p>Reading preview image...</p>}
          {previewFileName && (
            <p className="form-hint">Selected preview: {previewFileName}</p>
          )}
          {previewDataUrl && (
            <div className="create-content-preview">
              <img src={previewDataUrl} alt="Project preview" />
            </div>
          )}

          <label htmlFor="project-file">Downloadable file</label>
          <input
            id="project-file"
            type="file"
            accept=".aseprite"
            onChange={(event) => void handleProjectFileChange(event)}
            disabled={isReadingProjectFile || isSaving}
            required
          />
          <p className="form-hint">
            The original .aseprite file must be no larger than 10 KB.
          </p>

          {isReadingProjectFile && <p>Reading project file...</p>}
          {projectFileName && (
            <p className="form-hint">
              Selected file: {projectFileName} ({projectFileSize} bytes)
            </p>
          )}

          <label htmlFor="project-tags">Tags</label>
          <input
            id="project-tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="game, assets, pixel-art"
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
              {isSaving ? 'Publishing...' : 'Publish Project'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}


// ---------------------------------------------------------------------------

// Utility functions

// reads a file and converts it into an URL
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = () => {
      if (typeof fileReader.result === 'string') {
        resolve(fileReader.result);
      } else {
        reject(new Error('The file could not be read as a Data URL.'));
      }
    };

    fileReader.onerror = () => reject(new Error('The file could not be read.'));
    fileReader.readAsDataURL(file);
  });
}

// Convert the original bytes to a Base64 string without adding a Data URL prefix.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binaryString = '';

  for (const currentByte of bytes) {
    binaryString += String.fromCharCode(currentByte);
  }

  return window.btoa(binaryString);
}

export default CreateProjectPage;
