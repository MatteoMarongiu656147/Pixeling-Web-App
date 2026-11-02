
/** Displays Firestore comments and passes create/delete actions to the detail page. */
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link } from 'react-router';
import type { ContentComment } from '../../types/comment';

// Props contain functions for adding and deleting comments
type CommentSectionProps = {
  comments: ContentComment[];
  currentUserUid: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  deletingCommentId: string | null;
  errorMessage: string;
  loadErrorMessage: string;
  onAddComment: (text: string) => Promise<boolean>;
  onDeleteComment: (commentId: string) => Promise<void>;
};

// Props are passed  by ArtworkDetailPage and SpriteDetailPage
function CommentSection(props: CommentSectionProps) {

  // re-renders the component when the comment text written by the user changes
  const [newCommentText, setNewCommentText] = useState('');

  async function handleCommentSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    // Empty comment
    if (!newCommentText.trim() || props.isSubmitting) {
      return;
    }

    // Clear the form only after Firestore confirms the comment was saved.
    const wasSaved = await props.onAddComment(newCommentText);
    if (wasSaved) setNewCommentText('');
  }

  return (
    <section className="comment-section">
      <h2>Comments ({props.comments.length})</h2>

      {/* if there is a currentUserUid, it means the user is logged in and the comments section is shown,
        otherwise a fallback "login to add a comment" will be shown */}
      {props.currentUserUid ? (
        <form className="comment-form" onSubmit={(event) => void handleCommentSubmit(event)}>
          <label htmlFor="new-comment">Add a comment</label>
          <p className="section-description">
            Comments can contain up to 1000 characters.
          </p>

          <textarea
            id="new-comment"
            value={newCommentText}
            onChange={(event) => setNewCommentText(event.target.value)}
            placeholder="Share your thoughts..."
            rows={3}
            maxLength={1000}
            disabled={props.isSubmitting}
          />
          <button
            type="submit"
            disabled={!newCommentText.trim() || props.isSubmitting}
          >
            {props.isSubmitting ? 'Posting...' : 'Post comment'}
          </button>
        </form>
      ) : (
        <p className="section-description">
          <Link to="/login">Log in</Link> to add a comment.
        </p>
      )}



      {props.errorMessage && (
        <p className="section-description" role="alert">
          {props.errorMessage}
        </p>
      )}


      {/* comments list */}
      <div className="comment-list">

        {props.isLoading ? (
          <p className="section-description">Loading comments...</p>
        ) : props.comments.length > 0 ? (
          props.comments.map((currentComment) => (
            <article className="comment" key={currentComment.id}>
              <p className="comment-author">
                <span aria-hidden="true">@</span>
                {currentComment.username}
              </p>

              <p className="comment-text">{currentComment.text}</p>
              <div className="comment-actions">
                {Number.isFinite(Date.parse(currentComment.createdAt)) && (
                  <time dateTime={currentComment.createdAt}>
                    {new Date(currentComment.createdAt).toLocaleString()}
                  </time>
                )}
                {/* shows the delete comment button only if it is owned by the user */}
                {props.currentUserUid === currentComment.userUid && (
                  <button
                    type="button"
                    className="comment-delete-button"
                    aria-label={`Delete comment by ${currentComment.username}`}
                    disabled={props.deletingCommentId !== null}
                    onClick={() => void props.onDeleteComment(currentComment.id)}
                  >
                    {props.deletingCommentId === currentComment.id
                      ? 'Deleting...'
                      : 'Delete'}
                  </button>
                )}
              </div>
            </article>
          ))
        
        // No content section
        ) : props.loadErrorMessage ? null : (
          <p className="section-description">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </section>
  );
}

export default CommentSection;
