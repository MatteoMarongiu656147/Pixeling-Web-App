
/**
 * Displays a downloadable project preview and file information.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import type { Project } from '../../types/project';
import { getProjectById } from '../../services/projectService';
import TagList from '../content/TagList';
import DeleteContentButton from '../content/DeleteContentButton';

// The project card contains an additional button to download the file of the project.

// The component takes a project of type Project as a prop, and an optional function onDelete
// that takes the ID of the artwork as a parameter and returns nothing.
// These props are propagated from ProjectGrid, and further from ProjectsPage or ProfilePage.
// If there is an onDelete function in the props, a DeleteContentButton is shown,
// making deleting a project possible.
// The onDelete function is passed to ProjectGrid from the ProfilePage if the profile shown
// is the one of the logged in user.
function ProjectCard(props: {project: Project; onDelete?: (projectId: string) => void;}) {

  const project = props.project;

  // 
  const [downloadError, setDownloadError] = useState('');

  const fileSizeInKb = Math.round(project.fileSizeBytes / 1024);

  // The file will be downloaded from the Firestore db.
  // Fetch the saved Base64 payload and rebuild the exact original bytes for download.
  // This function is the onClick function of the downloading button.
  async function handleFirestoreDownload() {

    setDownloadError('');

    try {
      const savedProject = await getProjectById(project.id);

      // Check if the file exists and the extension is correct
      if (
        !savedProject ||
        !savedProject.projectFileData ||
        !savedProject.fileName.toLowerCase().endsWith('.aseprite')
      ) {
        throw new Error('The saved project file is missing or invalid.');
      }

      // extracts the binary data from the found project
      const binaryData = window.atob(savedProject.projectFileData);

      // checks for errors in the binary data if it doesn't match with the size and length
      // of the original stored project 
      if (
        binaryData.length !== savedProject.fileSizeBytes ||
        binaryData.length > 10 * 1024
      ) {
        throw new Error('The saved project file data is incomplete or invalid.');
      }

      // Begins converting the saved binary data into a downloadable file 
      // and triggers the browser download using a temporary URL.
      const originalBytes = new ArrayBuffer(binaryData.length);
      const byteView = new Uint8Array(originalBytes);

      for (let byteIndex = 0; byteIndex < binaryData.length; byteIndex += 1) {
        byteView[byteIndex] = binaryData.charCodeAt(byteIndex);
      }

      const projectFileBlob = new Blob([originalBytes], {
        type: savedProject.mimeType,
      });
      const temporaryDownloadUrl = URL.createObjectURL(projectFileBlob);
      const downloadLink = document.createElement('a');

      downloadLink.href = temporaryDownloadUrl;
      downloadLink.download = savedProject.fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      // Keep the temporary URL alive long enough for the browser to start downloading.
      window.setTimeout(() => URL.revokeObjectURL(temporaryDownloadUrl), 1000);
    } catch (error) {
      console.error('Unable to download the project file:', error);
      setDownloadError(
        'Unable to download this project file. The saved file may be missing or invalid.'
      );
    }
  }

  return (
    <article className="artwork-card">
      {props.onDelete && (
        <DeleteContentButton
          contentType="project"
          onDelete={() => props.onDelete?.(project.id)}
        />
      )}

      <img
        className="artwork-image"
        src={project.previewUrl}
        alt={project.title}
      />

      <div className="artwork-info">
        <div className="project-card-heading">
          <h3>{project.title}</h3>
          {/*the button calls the handle download function */}
          <button
            className="content-download-button"
            type="button"
            onClick={() => void handleFirestoreDownload()}
            aria-label={`Download ${project.fileName}`}
            title={`Download ${project.fileName}`}
            >
            <DownloadIcon />
          </button>
        </div>
        <p>
          {project.description}
        </p>
        <p>
          by <Link to={`/profile/${project.artistUsername}`}>
            {project.artistUsername}
          </Link>
        </p>
        <p>{project.fileName} · {fileSizeInKb} KB</p>
        <TagList tags={project.tags} />
        {downloadError && (
          <p className="section-description" role="alert">
            {downloadError}
          </p>
        )}

      </div>
    </article>
  );
}

// Additional component used to design a graphic "download" icon.
// Used in the button for the download, so it's clickable.
function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="content-download-icon"
    >
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
    </svg>
  );
}

export default ProjectCard;
