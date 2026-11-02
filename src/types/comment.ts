
/** A comment stored in an artwork or sprite Firestore subcollection. */
export type ContentComment = {
  id: string;
  userUid: string;
  username: string;
  text: string;
  createdAt: string;
};
