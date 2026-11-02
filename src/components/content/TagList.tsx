/** Displays the tags associated with a piece of content. 
 * Represents a list of tags of a content (e.g. fantasy, landscape, food...)
*/
import { Link } from 'react-router';

// Clicking on a tag will result in redirecting to the search for content page.
// It will automatically fill the search bar with the clicked tag.
// Tags can be optional, so props can be empty.
function TagList(props: { tags?: string[] }) {

  // if there are no tags in the props, use an empty array.
  const tags = props.tags ?? [];

  if (tags.length === 0) {
    return null;
  }

  return (
    <ul className="content-tags" aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>
          {/*Each tag is clickable and sends to the search page*/}
          <Link className="content-tag" to={`/search?tag=${encodeURIComponent('#' + tag)}`}>
            #{tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default TagList;
