/** A shared, accessible delete control for owned content cards. 
 * This button is used to delete an Artwork, a Sprite or a Project from
 * the owned profile page.
*/

// The button takes a content type and an onDelete function as props.
// When clicked, it will execute the onDelete function.
// The props are passed from ArtworkCard, ProjectCard, and SpriteCard components.
type DeleteContentButtonProps = {
  contentType: 'artwork' | 'sprite' | 'project';
  onDelete: () => void;
};

function DeleteContentButton(props: DeleteContentButtonProps) {
  return (
    <button
      className="content-delete-button"
      type="button"
      aria-label={`Delete ${props.contentType}`}
      title={`Delete ${props.contentType}`}
      onClick={props.onDelete}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        className="content-delete-icon"
      >
        <path d="M4 7h16M10 11v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3" />
      </svg>
    </button>
  );
}

export default DeleteContentButton;
