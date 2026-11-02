
/** Displays all Firestore artwork, sprite, and project content in the home feed. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { getAllArtworks } from '../services/artworkService';
import { getAllSprites } from '../services/spriteService';
import { getAllProjects } from '../services/projectService';
import type { Artwork } from '../types/artwork';
import type { Sprite } from '../types/sprite';
import type { Project } from '../types/project';
import ArtworkGrid from '../components/artwork/ArtworkGrid';
import SpriteGrid from '../components/sprite/SpriteGrid';
import ProjectGrid from '../components/project/ProjectGrid';

function HomePage() {
  // content states
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // loading states
  const [isLoadingArtworks, setIsLoadingArtworks] = useState(true);
  const [isLoadingSprites, setIsLoadingSprites] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // error states
  const [artworkError, setArtworkError] = useState('');
  const [spriteError, setSpriteError] = useState('');
  const [projectError, setProjectError] = useState('');

  // The services return all content newest first; the home feed previews three per category.
  // If the user clicks on "view all", the app will redirect to ArtworkPage or SpritePage,
  // where all content for the chosen category will be shown.
  const displayedArtworks = artworks.slice(0, 3);
  const displayedSprites = sprites.slice(0, 3);
  const displayedProjects = projects.slice(0, 3);

  // On mount: load each category independently so one failed collection does not hide the others.
  useEffect(() => {
    let isActive = true;

    async function loadArtworks() {
      try {
        // calls the artworkService
        const loadedArtworks = await getAllArtworks();
        if (isActive) setArtworks(loadedArtworks);
      } catch (error) {
        if (isActive) {
          console.error('Unable to load home artworks:', error);
          setArtworkError('Unable to load artworks. Please try again.');
        }
      } finally {
        if (isActive) setIsLoadingArtworks(false);
      }
    }

    async function loadSprites() {
      try {
        // calls the spriteService
        const loadedSprites = await getAllSprites();
        if (isActive) setSprites(loadedSprites);
      } catch (error) {
        if (isActive) {
          console.error('Unable to load home sprites:', error);
          setSpriteError('Unable to load sprites. Please try again.');
        }
      } finally {
        if (isActive) setIsLoadingSprites(false);
      }
    }

    async function loadProjects() {
      try {
        // calls the projectService
        const loadedProjects = await getAllProjects();
        if (isActive) setProjects(loadedProjects);
      } catch (error) {
        if (isActive) {
          console.error('Unable to load home projects:', error);
          setProjectError('Unable to load projects. Please try again.');
        }
      } finally {
        if (isActive) setIsLoadingProjects(false);
      }
    }

    // loads every category of content
    void loadArtworks();
    void loadSprites();
    void loadProjects();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="main-content feed-page">
      <header className="feed-header">
        <h1>Discover something new</h1>
        <p className="section-description">
          Explore artwork, sprites, and downloadable projects
          created by the Pixeling community.
        </p>
      </header>

      <section className="feed-section" id="discover-artworks">
        <div className="feed-section-header">
          <div>
            <h2>Discover Artworks</h2>
            <p className="section-description">
              Discover pixel art from the community.
            </p>
          </div>

          <Link to="/artworks">View all</Link>
        </div>

        {isLoadingArtworks ? (
          <p className="section-description">Loading artworks...</p>
        ) : artworkError ? (
          <p className="section-description" role="alert">{artworkError}</p>
        ) : artworks.length === 0 ? (
          <p className="section-description">No artworks have been published yet.</p>
        ) : (
          <ArtworkGrid artworks={displayedArtworks} />
        )}
      </section>

      <section className="feed-section" id="discover-sprites">
        <div className="feed-section-header">
          <div>
            <h2>Discover Sprites</h2>
            <p className="section-description">
              Find characters, items, animations, and other sprite models.
            </p>
          </div>

          <Link to="/sprites">View all</Link>
        </div>

        {isLoadingSprites ? (
          <p className="section-description">Loading sprites...</p>
        ) : spriteError ? (
          <p className="section-description" role="alert">{spriteError}</p>
        ) : sprites.length === 0 ? (
          <p className="section-description">No sprites have been published yet.</p>
        ) : (
          <SpriteGrid sprites={displayedSprites} />
        )}
      </section>

      <section className="feed-section" id="discover-projects">
        <div className="feed-section-header">
          <div>
            <h2>Discover Projects</h2>
            <p className="section-description">
              Explore Aseprite projects available for download.
            </p>
          </div>

          <Link to="/projects">View all</Link>
        </div>

        {isLoadingProjects ? (
          <p className="section-description">Loading projects...</p>
        ) : projectError ? (
          <p className="section-description" role="alert">{projectError}</p>
        ) : projects.length === 0 ? (
          <p className="section-description">No projects have been published yet.</p>
        ) : (
          <ProjectGrid projects={displayedProjects} />
        )}
      </section>
    </main>
  );
}

export default HomePage;
