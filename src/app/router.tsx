
/**
 * Defines the application routes and provides Firebase authentication state.
 */
import { BrowserRouter, Routes, Route } from 'react-router';

import App from './App';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

import WelcomePage from '../pages/WelcomePage';
import HomePage from '../pages/HomePage';
import ArtworkPage from '../pages/ArtworkPage';
import ArtworkDetailPage from '../pages/ArtworkDetailPage';
import ProfilePage from '../pages/ProfilePage';
import NotFoundPage from '../pages/NotFoundPage';
import SpritesPage from '../pages/SpritesPage';
import SpriteDetailPage from '../pages/SpriteDetailPage';
import ProjectsPage from '../pages/ProjectsPage';
import NotificationsPage from '../pages/NotificationsPage';
import SearchPage from '../pages/SearchPage';
import LoginPage from '../pages/LoginPage';
import SigninPage from '../pages/SigninPage';
import CreateArtworkPage from '../pages/CreateArtworkPage';
import CreateSpritePage from '../pages/CreateSpritePage';
import CreateProjectPage from '../pages/CreateProjectPage';
import EditProfilePage from '../pages/EditProfilePage';
import FollowingProfilesPage from '../pages/FollowingProfilesPage';
import FollowedProfilesPage from '../pages/FollowedProfilesPage';

function AppRoutes() {
  // useAuth is needed because the application shows a different page
  // when a user is logged or not
  const authState = useAuth();

  // Wait for Firebase to restore the current authentication session.
  if (authState.isLoading) {
    return <p>Loading Pixeling...</p>;
  }

  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route
          // if the user is logged, show the HomePage, otherwise show the WelcomePage
          index
          element={authState.isLoggedIn ? <HomePage /> : <WelcomePage />}
        />
        <Route path="login" element={<LoginPage />} />
        <Route path="signin" element={<SigninPage />} />
        <Route path="home" element={<HomePage />} />
        <Route path="artworks" element={<ArtworkPage />} />
        <Route path="artworks/:artworkId" element={<ArtworkDetailPage />} />
        <Route path="profile/:username" element={<ProfilePage />} />
        <Route path="profile/:username/following" element={<FollowingProfilesPage />} />
        <Route path="profile/:username/followers" element={<FollowedProfilesPage />} />
        <Route path="sprites" element={<SpritesPage />} />
        <Route path="sprites/:spriteId" element={<SpriteDetailPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="create/artwork" element={<CreateArtworkPage />} />
        <Route path="create/sprite" element={<CreateSpritePage />} />
        <Route path="create/project" element={<CreateProjectPage />} />
        <Route path="profile/:username/edit" element={<EditProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

// AppRouter() contains the provider of the authentication context (AuthContext.tsx)
// AppRoutes will inherit the context and every child element can "listen" to it (useContext)
// This means every Route in AppRoutes can do useContext.
function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default AppRouter;
