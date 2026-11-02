/**
 * Displays the details and image of a single sprite.
 * Includes the likes and comments, as well as the description.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getSpriteById } from '../services/spriteService';
import type { Sprite } from '../types/sprite';
import { useContentInteractions } from '../hooks/useContentInteractions';

import LikeButton from '../components/social/LikeButton';
import CommentSection from '../components/social/CommentSection';
import TagList from '../components/content/TagList';

function SpriteDetailPage() {
  // useParams retrieves the dynamic parameters defined in the route. 
  // If the URL is /sprites/pixel-world, the spriteId parameter will be "pixel-world"
  const params = useParams();
  const spriteId = params.spriteId;

  const [sprite, setSprite] = useState<Sprite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // This is the custom hook that cointains information about interactions with the
  // content (likes, comments, loading states etc)
  const interactions = useContentInteractions('sprite', spriteId);

  // Load the sprite using the Firestore document ID from the card's route.
  useEffect(() => {
    let isActive = true;

    async function loadSprite() {

      if (!spriteId) {
        setSprite(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError('');

      try {
        // calls the spriteService function to get the sprite by id
        const firestoreSprite = await getSpriteById(spriteId);
        if (isActive) {
          setSprite(firestoreSprite);
        }
      } catch (error) {
        if (isActive) {
          console.error('Unable to load sprite details:', error);
          setSprite(null);
          setLoadError('Unable to load this sprite. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    // calls the defined function
    void loadSprite();

    return () => {
      // prevent invalid operations when the component is unmounted
      isActive = false;
    };
  }, [spriteId]); // executed each time the spriteId changes


  // Distinguish the page whether it's still loading, there is an error, 
  // or the page is loaded succesfully.

  if (isLoading) {
    return (
      <main className="main-content">
        <p>Loading sprite...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="main-content">
        <h1>Unable to load sprite</h1>
        <p>{loadError}</p>
        <Link to="/sprites">Back to sprites</Link>
      </main>
    );
  }

  if (!sprite) {
    return (
      <main className="main-content">
        <h1>Sprite not found</h1>
        <p>The sprite you are looking for does not exist.</p>
        <Link to="/sprites">Back to sprites</Link>
      </main>
    );
  }

  return (
    <main className="main-content">
      <section className="sprite-detail">
        <div className="sprite-detail-main">
          <header className="detail-heading">
            <h1>{sprite.title}</h1>
            <p>
              by <Link to={`/profile/${sprite.artistUsername}`}>
                {sprite.artistUsername}
              </Link>
            </p>
          </header>
          <p className="sprite-description">{sprite.description}</p>
          <TagList tags={sprite.tags} />

          {/* Show the single animated image when this sprite is animated. */}
          {sprite.type === 'animated' ? (
            <div className="sprite-animation">
              <img
                className="sprite-animation-preview"
                src={sprite.animationUrl}
                alt={`${sprite.title} animated preview`}
              />
            </div>
          ) : (
            <img
              className="sprite-static-preview"
              src={sprite.previewUrl}
              alt={sprite.title}
            />
          )}
          <Link className="detail-back-link" to="/sprites">← Back to sprites</Link>
        </div>

        {/*this is where the information contained by the custom hook is used*/}
        <div className="sprite-social">
          <LikeButton
            likeCount={interactions.likes.length}
            isLiked={Boolean(
              interactions.currentUserUid &&
              interactions.likes.includes(interactions.currentUserUid)
            )}
            isAuthenticated={interactions.isAuthenticated}
            isLoading={interactions.isLoadingLikes}
            isSubmitting={interactions.isSubmittingLike}
            errorMessage={interactions.likeError}
            onToggle={interactions.toggleLike}
          />

          <CommentSection
            comments={interactions.comments}
            currentUserUid={interactions.currentUserUid}
            isLoading={interactions.isLoadingComments}
            isSubmitting={interactions.isSubmittingComment}
            deletingCommentId={interactions.deletingCommentId}
            errorMessage={interactions.commentError}
            loadErrorMessage={interactions.commentLoadError}
            onAddComment={interactions.postComment}
            onDeleteComment={interactions.deleteComment}
          />
        </div>

      </section>
    </main>
  );
}

export default SpriteDetailPage;
