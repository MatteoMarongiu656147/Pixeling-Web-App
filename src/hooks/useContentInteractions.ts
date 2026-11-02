/** This hook keeps detail-page like and comment state synchronized with Firestore. 
 * Used by ArtworkDetailPage and SpriteDetailPage.
*/
import { useEffect, useState } from 'react';

import {
  addContentComment,
  addContentLike,
  deleteContentComment,
  removeContentLike,
  subscribeToContentComments,
  subscribeToContentLikes,
} from '../services/likeAndCommentService';
import type { LikeableContentType } from '../services/likeAndCommentService';
import type { ContentComment } from '../types/comment';
import { useAuth } from '../contexts/AuthContext';

// contentType can be an artwork or a sprite (see likeAndCommentService.ts)
export function useContentInteractions(contentType: LikeableContentType, 
                                        contentId: string | undefined) {

  // authentication context
  const authState = useAuth();
  const currentUserUid = authState.user?.uid ?? null; // gets the user's UID from the context's value

  const [likes, setLikes] = useState<string[]>([]); // array of users' UIDs that liked the content
  const [comments, setComments] = useState<ContentComment[]>([]); // array of comments in the content
  const [isLoadingLikes, setIsLoadingLikes] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isSubmittingLike, setIsSubmittingLike] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null); // ID of the comment we are trying to delete
  const [likeError, setLikeError] = useState(''); // Error message from a failed like
  const [commentError, setCommentError] = useState(''); // Error message from a failed comment
  // Separate listener failures from post/delete errors so an unreadable list is not shown as empty.
  const [commentLoadError, setCommentLoadError] = useState('');

  // Each listener returns an unsubscribe function, so changing pages or IDs
  // cannot leave an old content listener running in the background.
  // Executed whenever the content (contentId) or the type of content we are viewing changes.
  useEffect(() => {

    // resets the previous data
    setLikes([]);
    setComments([]);
    setLikeError('');
    setCommentError('');
    setCommentLoadError('');

    // exits if there is no content
    if (!contentId) {
      setIsLoadingLikes(false);
      setIsLoadingComments(false);
      return;
    }

    // sets the loading state for likes and comments when we open the content page
    setIsLoadingLikes(true);
    setIsLoadingComments(true);

    // calls the likeAndCommentService function to subscribe to like modifications.
    // the function returns a function to stop listening.
    const unsubscribeLikes = subscribeToContentLikes(
      contentType,
      contentId,
      // passes the callback and the error functions
      (loadedLikes) => { // executed when likes are loaded
        setLikes(loadedLikes);
        setIsLoadingLikes(false);
      },
      (error) => {
        console.error('Unable to listen for content likes:', error);
        setLikeError('Unable to load likes. Please try again.');
        setIsLoadingLikes(false);
      }
    );

    // calls the subscribeToContentComments function by likeAndCommentService as well.
    // the function returns a function to stop listening.
    const unsubscribeComments = subscribeToContentComments(
      contentType,
      contentId,
      (loadedComments) => {
        setComments(loadedComments);
        setCommentLoadError('');
        setIsLoadingComments(false);
      },
      (error) => {
        console.error('Unable to listen for content comments:', error);
        const loadErrorMessage = 'Unable to load comments. Please try again.';
        setCommentLoadError(loadErrorMessage);
        setCommentError(loadErrorMessage);
        setIsLoadingComments(false);
      }
    );

    // on cleanup, unsubscribes from receiving like and comment updates by calling the obtained functions
    // from the service likeAndCommentService.
    return () => {
      unsubscribeLikes();
      unsubscribeComments();
    };
  }, [contentType, contentId]);


  // this function is executed when ArtworkDetailPage or SpriteDetailPage calls it with a LikeButton.
  // It's passed to it through the props, after taking it from this hook.
  async function toggleLike() {

    if (!currentUserUid || !contentId || isSubmittingLike) {
      return; // interrupt the operation
    }

    setLikeError('');
    setIsSubmittingLike(true);

    try {
      // decides to remove or to activate a like, based on the state of it.
      // Uses the likeAndCommentService's functions to do so.
      // Waits for Firestore to confirm the change; the snapshot then updates the count.
      if (likes.includes(currentUserUid)) {
        await removeContentLike(contentType, contentId);
      } else {
        await addContentLike(contentType, contentId);
      }
      // errors
    } catch (error) {
      console.error('Unable to update content like:', error);
      setLikeError('Unable to update your like. Please try again.');
    } finally {
      setIsSubmittingLike(false);
    }
  }


  // Function executed by the button that publishes a comment in ArtworkDetailPage or SpriteDetailPage.
  // Same logic and functionality as toggleLike.
  async function postComment(text: string): Promise<boolean> {

    if (!currentUserUid || !contentId || isSubmittingComment) {
      return false;
    }

    setCommentError('');
    setIsSubmittingComment(true);

    try {
      // likeAndCommentService
      await addContentComment(contentType, contentId, text);
      return true;
    } catch (error) {
      console.error('Unable to add content comment:', error);
      setCommentError(
        error instanceof Error
          ? error.message
          : 'Unable to post your comment. Please try again.'
      );
      return false;
    } finally {
      setIsSubmittingComment(false);
    }
  }


  // Function that deletes a comment from the comment section (and from firestore)
  // Uses the likeAndCommentService's function to do so. Same functionality as the above functions.
  async function deleteComment(commentId: string) {

    if (!currentUserUid || !contentId || deletingCommentId) {
      return;
    }

    setCommentError('');
    setDeletingCommentId(commentId);

    try {
      // likeAndCommentService
      await deleteContentComment(contentType, contentId, commentId);
    } catch (error) {
      console.error('Unable to delete content comment:', error);
      setCommentError(
        error instanceof Error
          ? error.message
          : 'Unable to delete this comment. Please try again.'
      );
    } finally {
      setDeletingCommentId(null);
    }
  }

  return {
    currentUserUid,
    isAuthenticated: Boolean(currentUserUid),
    likes,
    comments,
    isLoadingLikes,
    isLoadingComments,
    isSubmittingLike,
    isSubmittingComment,
    deletingCommentId,
    likeError,
    commentError,
    commentLoadError,

    // returns the functions as well. They can be used by the buttons in the pages.
    toggleLike,
    postComment,
    deleteComment,
  };
}
