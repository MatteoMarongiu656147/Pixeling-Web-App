/**
 * Displays the details of a selected artwork.
 * Follows the exact logic and content of SpriteDetailPage.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getArtworkById } from '../services/artworkService';
import type { Artwork } from '../types/artwork';
import { useContentInteractions } from '../hooks/useContentInteractions';

import LikeButton from '../components/social/LikeButton';
import CommentSection from '../components/social/CommentSection';
import TagList from '../components/content/TagList';

function ArtworkDetailPage() {
  // useParams retrieves the dynamic parameters defined in the route. 
  // If the URL is /artworks/pixel-world, the artworkId parameter will be "pixel-world"
  const routeParams = useParams();
  const artworkId = routeParams.artworkId;

  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Custom hook, used by SpriteDetailPage as well
  const interactions = useContentInteractions('artwork', artworkId);

  // Artwork cards use Firestore document IDs, so load the matching document directly.
  useEffect(() => {
    let isActive = true;

    async function loadArtwork() {

      if (!artworkId) {
        setSelectedArtwork(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError('');
      try {
        // calls the artworkService
        const firestoreArtwork = await getArtworkById(artworkId);
        if (isActive) {
          setSelectedArtwork(firestoreArtwork);
        }
      } catch (error) {
        if (isActive) {
          console.error('Unable to load artwork details:', error);
          setSelectedArtwork(null);
          setLoadError('Unable to load this artwork. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    // calls the defined function
    void loadArtwork();

    return () => {
      // prevents invalid operations when the component is unmounted
      isActive = false;
    };
  }, [artworkId]);

  
  // Distinguish the various pages to show whenever the content is still loading,
  // There is an error, or the page has loaded correctly.

  if (isLoading) {
    return (
      <main className="main-content">
        <p>Loading artwork...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="main-content">
        <h1>Unable to load artwork</h1>
        <p>{loadError}</p>
        <Link to="/artworks">Back to artworks</Link>
      </main>
    );
  }

  if (!selectedArtwork) {
    return (
      <main className="main-content">
        <h1>Artwork not found</h1>
        <Link to="/explore">Back to Explore</Link>
      </main>
    );
  }

  return (
    <main className="main-content">
      <section className="artwork-detail">
        <div className="artwork-detail-main">
        <header className="detail-heading">
          <h1>{selectedArtwork.title}</h1>
          <p>
            by <Link to={`/profile/${selectedArtwork.artistUsername}`}>
            {selectedArtwork.artistUsername}
          </Link>            
          </p>
        </header>
        <p>{selectedArtwork.description ? selectedArtwork.description : ''}</p>
        <TagList tags={selectedArtwork.tags} />
        <img
          className="artwork-image"
          src={selectedArtwork.imageUrl}
          alt={selectedArtwork.title}
        />

        <Link className="detail-back-link" to="/artworks">← Back to artworks</Link>
        </div>

        {/* this is where the custom hook's properties are used*/}
        <div className="artwork-social">
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

export default ArtworkDetailPage;
