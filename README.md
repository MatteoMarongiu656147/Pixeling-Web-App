# Pixeling

## Brief Project Description

Pixeling is a web application developed with React, TypeScript and Firebase.
The application allows users to create and share pixel art content, interact with other users through likes and comments, 
follow other users and receive in-app notifications. Push notifications are supported with Firebase Cloud Messaging.

## Online Application

Pixeling is deployed and hosted on Firebase Hosting. You can access the application online at the following link:

https://pixeling-6c5c0.web.app/

or:

https://pixeling-6c5c0.firebaseapp.com/

Pixeling can be installed as a Progressive Web App through the browser's page settings.

## Requirements

To run the project locally, you need:

- [Node.js](https://nodejs.org/) (including npm). Node.js 24.12.0 or higher is recommended to avoid warnings when installing.
- Any web browser.
- The Firebase configuration required by the application is already provided in the source files.

## Installation and Local Setup

Follow these steps to install and run Pixeling on your local machine.

1. Clone the repository on your local environment

2. Copy the .env.local file in the main folder of the project (contains the VAPID key for push notifications)

3. Install dependencies. Open the terminal on the main folder of the project and install all the project dependencies:

```bash
npm install
```

4. Start the development server. Run:

```bash
npm run dev
```

The application will be available at the local URL displayed in the terminal (usually `http://localhost:5173`).
PWA functionalities will not be available when executing the app like this, but it will still be possible to use it
in the browser since it will interact with Firebase correctly.

### Building and testing the PWA Locally

To test the Progressive Web App (PWA) locally, run the following commands from the project directory:

```bash
npm install
npm run build
npm run preview
```

The compiled application will be generated in the `dist` directory.
You will be able to open the local URL displayed in the terminal (usually `http://localhost:4173`).

This serves the production build locally and allows you to test the PWA features, such as installation, asset precaching and offline behavior, without accessing the deployed application.

## Test Accounts

Pixeling provides authentication with email and password.
The following accounts can be used to access the application and test its features.

### Test User 1

- Email: testuser@pixeling.com
- Password: testuser12345

### Test User 2

- Email: testuser2@pixeling.com
- Password: testuser23456

## User Registration

It is also possible to create a new account directly from the application.

To register, click on Sign In on the top right of the app, and complete the form. A new account will be
registered in Firebase Authentication and the new profile's data will be saved in Firestore.

Once signed in, you will be automatically logged in with the new profile.

## Application usage

After signing in or logging in, you can use Pixeling as an authenticated user. This includes exploring for content
in the home page, viewing content, add or delete likes and comments, and download .aseprite projects files that can be
actually opened in Aseprite.

A search page is available for searching content by name, tags or description, and searching users as well. Clicking
on a tag will redirect to the search page with the input already filled in with the tag.

Profile pages show a display name and the username of the user, following and follower statistics, and a profile
picture and banner. You can follow and unfollow other users, and the list of following and follower users can be accessed
through the profile page. Profile pages also provide three different sections for all the user's content (artworks,
sprites and projects). 

In the authenticated profile page, you can edit your profile information (such as display name and
profile pictures) and upload new content. For functionality purposes, since Firestore documents can reach up to 1 MiB,
the content you can upload can be of limited dimension (usually 100 KB, 50 KB or 10 KB depending on the content). This
is still acceptable and functional since pixel art and projects exported from Aseprite are usually within these dimensions,
so they can easily be converted in URL without taking too much space. Deleting content is also possible from your profile page,
but deleting a content won't delete the subcollections of comments and likes for that content, which will remain in Firestore.

Some test files are included and provided in the "testfiles" directory of the project, so you can try to upload new content.

In-app notifications include like, comment and follow notifications. You will receive an in-app notification whenever
a user likes or comments your content, and starts following you. Notifications can be marked as read.

Push notifications are supported, but require to be sent manually from the Firebase Cloud Messaging console in the 
authenticated admin account where the application is hosted. You can enable them by using a button in the Navbar, and a
copy button will be shown. This button will copy a token, and this token can be used to manually send a push notification
to your device from Firebase.

When you try to open the app while offline, the offline fallback page will be shown. When the connection falls while you
are using the app, the app automatically shows a page similar to the offline fallback page where it waits for the connection
to be restored. When restored, it will show a retry button to load the page.

## Notes

The application uses Firebase services for authentication, database operations, hosting and push notifications.
Some features may require the browser to grant the necessary permissions, such as notification permissions.
Push notifications are visualized only when the app is in background.