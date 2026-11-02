/** Defines the metadata and original file stored for a Firestore project. */
export type Project = {
  id: string;
  title: string;
  description: string;
  // This is the author's unique username, not their editable display name.
  artistUsername: string;
  artistUid: string;
  createdAt?: string;
  tags?: string[];
  previewUrl: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  projectFileData: string;
};
