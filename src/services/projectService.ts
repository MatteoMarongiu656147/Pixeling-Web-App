/** Creates, puts, reads, and deletes project documents stored in Firestore. */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';

import { db } from './firebase';
import type { Project } from '../types/project';
import { sortByCreatedAtNewestFirst } from '../utils/sortByCreatedAt';

// ------------------------------------------------------------------------------------------------

// Used when creating a new project, omits id and createdAt from the type Project because they 
// are not interesting when "building" a project
type CreateProjectData = Omit<Project, 'id' | 'createdAt'>;

// Macros used for various security/consistence checks when creating a project
const MAX_PREVIEW_DATA_URL_LENGTH = 68300;
const MAX_PROJECT_FILE_SIZE = 10 * 1024;
const MAX_PROJECT_FILE_BASE64_LENGTH = 13656;
const MAX_FIRESTORE_DOCUMENT_BYTES = 900 * 1024;

// -----------------------------------------------------------------------------------------------

// transform a document read from Firestore into a Project object, adapting some of its fields
// to the format used by the application.
function mapProjectDocument(projectId: string, projectData: DocumentData): Project {

  const createdAtValue = projectData.createdAt;
  const createdAt =
    createdAtValue instanceof Timestamp
      ? createdAtValue.toDate().toISOString()
      : typeof createdAtValue === 'string'
        ? createdAtValue
        : undefined;

  return {
    ...projectData,
    id: projectId,
    createdAt,
  } as Project;
}

// ---------------------------------------------------------------------------------------

// Creates a new project, and after building it, it adds it in Firestore.
/** Saves project metadata, a preview Data URL, and the original file as Base64. */
export async function createProject(projectData: CreateProjectData): Promise<string> {

  // Various security and consistency/integrity checks (max dimension, etc)

  if (!/^data:image\/(jpeg|png);base64,/.test(projectData.previewUrl)) {
    throw new Error('The project preview must be a JPG or PNG Data URL.');
  }

  if (projectData.previewUrl.length > MAX_PREVIEW_DATA_URL_LENGTH) {
    throw new Error('The project preview must be 50 KB or smaller.');
  }

  if (!projectData.fileName.toLowerCase().endsWith('.aseprite')) {
    throw new Error('The downloadable file must use the .aseprite extension.');
  }

  if (
    projectData.fileSizeBytes <= 0 ||
    projectData.fileSizeBytes > MAX_PROJECT_FILE_SIZE
  ) {
    throw new Error('The .aseprite file must be 10 KB or smaller.');
  }

  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(projectData.projectFileData) ||
    projectData.projectFileData.length > MAX_PROJECT_FILE_BASE64_LENGTH
  ) {
    throw new Error('The .aseprite file data is missing or invalid.');
  }

  // Confirm the Base64 payload decodes to exactly the selected file's byte count.
  let decodedFileSize: number;
  try {
    decodedFileSize = atob(projectData.projectFileData).length;
  } catch {
    throw new Error('The .aseprite file data is not valid Base64.');
  }

  if (decodedFileSize !== projectData.fileSizeBytes) {
    throw new Error('The encoded file size does not match the selected file.');
  }


  // Now we can create the project with the additional metadata needed for firestore
  const firestoreProjectData = {
    ...projectData,
    mimeType: 'application/octet-stream',
    createdAt: serverTimestamp(),
  };

  // Keep a margin below Firestore's 1 MiB document limit for its internal overhead.
  const estimatedDocumentBytes = new TextEncoder().encode(
    JSON.stringify(projectData)
  ).length;
  if (estimatedDocumentBytes > MAX_FIRESTORE_DOCUMENT_BYTES) {
    throw new Error('This project is too large to save in Firestore.');
  }

  // References the collection of projects in firestore and adds the new project
  const projectsCollection = collection(db, 'projects');
  const projectDocument = await addDoc(
    projectsCollection,
    firestoreProjectData
  );

  // returns the id of the created and added project
  return projectDocument.id;
}

// --------------------------------------------------------------------------------------

/** Retrieves projects owned by one Firebase user. */
export async function getProjectsByArtistUid(artistUid: string): Promise<Project[]> {

  // Reference to the collection and query
  const projectsCollection = collection(db, 'projects');
  const projectsQuery = query(
    projectsCollection,
    where('artistUid', '==', artistUid)
  );
  const projectsSnapshot = await getDocs(projectsQuery);

  // data extraction from the received documents (builds the object)
  const projects = projectsSnapshot.docs.map((projectDocument) =>
    mapProjectDocument(projectDocument.id, projectDocument.data())
  );

  // Show the newest projects first, matching artwork and sprite profiles.
  projects.sort((firstProject, secondProject) => {
    const firstDate = firstProject.createdAt
      ? new Date(firstProject.createdAt).getTime()
      : 0;
    const secondDate = secondProject.createdAt
      ? new Date(secondProject.createdAt).getTime()
      : 0;

    return secondDate - firstDate;
  });

  // returns the projects
  return projects;
}

// -------------------------------------------------------------------------------------------

/** Retrieves public projects for client-side search across the collection. */
export async function getAllProjects(): Promise<Project[]> {

  // reference to collection and documents
  const projectsCollection = collection(db, 'projects');
  const projectsSnapshot = await getDocs(projectsCollection);

  // mapping them and creating the object
  const projects = projectsSnapshot.docs.map((projectDocument) =>
    mapProjectDocument(projectDocument.id, projectDocument.data())
  );

  // uses this utility function from sortByCreatedAt in /src/utils
  return sortByCreatedAtNewestFirst(projects);
}

// ----------------------------------------------------------------------------------------------

/** Retrieves the saved project file and metadata by Firestore's document ID. */
export async function getProjectById(projectId: string): Promise<Project | null> {

  // reference to the specified project's doc
  const projectReference = doc(db, 'projects', projectId);
  const projectSnapshot = await getDoc(projectReference);

  if (!projectSnapshot.exists()) {
    return null;
  }

  return mapProjectDocument(projectSnapshot.id, projectSnapshot.data());
}

// --------------------------------------------------------------------------------------

/** Deletes a project by ID; Firestore rules verify that the caller owns it. */
export async function deleteProjectById(projectId: string): Promise<void> {
  const projectReference = doc(db, 'projects', projectId);

  await deleteDoc(projectReference);
}

