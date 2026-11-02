/** Displays the Firestore-backed like count and current user's like state. */

type LikeButtonProps = {
  likeCount: number;
  isLiked: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  errorMessage: string;
  onToggle: () => void;
};

// LikeButton is used in the ArtworkDetailPage and SpriteDetailPage.
// Props are passed by ArtworkDetailPage and SpriteDetailPage
function LikeButton(props: LikeButtonProps) {

  // determine if the button is disabled by looking at the conditions in the props
  const isDisabled = !props.isAuthenticated || props.isLoading || props.isSubmitting;

  // Label of the button
  const label = props.isAuthenticated
    ? props.isLiked
      ? 'Unlike this content'
      : 'Like this content'
    : 'Log in to like this content';

  return (
    <>
      <button
        type="button"
        className={`like-button ${props.isLiked ? 'liked' : ''}`}
        onClick={props.onToggle}
        disabled={isDisabled}
        aria-pressed={props.isLiked}
        aria-label={label}
        title={label}
      >
        <svg
          className="like-heart"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
        </svg>
        <span>{props.likeCount}</span>
      </button>
      {props.errorMessage && (
        <p className="section-description" role="alert">
          {props.errorMessage}
        </p>
      )}
    </>
  );
}

export default LikeButton;
