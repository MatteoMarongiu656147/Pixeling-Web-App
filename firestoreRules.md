rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // A like changes only the signed-in user's membership and active event ID.
    function addsOwnLike() {
      return request.auth != null
        && request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['likes', 'likeEventIds'])
        && request.resource.data.get('likes', []) is list
        && resource.data.get('likes', []) is list
        && request.resource.data.get('likeEventIds', {}) is map
        && resource.data.get('likeEventIds', {}) is map
        && request.resource.data.get('likes', []).size()
          == resource.data.get('likes', []).size() + 1
        && request.resource.data.get('likes', [])
          .hasAll(resource.data.get('likes', []))
        && request.auth.uid in request.resource.data.get('likes', [])
        && !(request.auth.uid in resource.data.get('likes', []))
        && request.resource.data.get('likeEventIds', {}).diff(
          resource.data.get('likeEventIds', {})
        ).affectedKeys().hasOnly([request.auth.uid])
        && !(request.auth.uid in resource.data.get('likeEventIds', {}))
        && request.resource.data.get('likeEventIds', {}).get(
          request.auth.uid, ''
        ) is string
        && request.resource.data.get('likeEventIds', {}).get(
          request.auth.uid, ''
        ).size() > 0;
    }

    function removesOwnLike() {
      return request.auth != null
        && request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['likes', 'likeEventIds'])
        && request.resource.data.get('likes', []) is list
        && resource.data.get('likes', []) is list
        && request.resource.data.get('likeEventIds', {}) is map
        && resource.data.get('likeEventIds', {}) is map
        && request.resource.data.get('likes', []).size()
          == resource.data.get('likes', []).size() - 1
        && resource.data.get('likes', [])
          .hasAll(request.resource.data.get('likes', []))
        && request.auth.uid in resource.data.get('likes', [])
        && !(request.auth.uid in request.resource.data.get('likes', []))
        && request.resource.data.get('likeEventIds', {}).diff(
          resource.data.get('likeEventIds', {})
        ).affectedKeys().hasOnly([request.auth.uid])
        && !(request.auth.uid in request.resource.data.get('likeEventIds', {}));
    }

    function validNotificationActor() {
      return request.auth != null
        && request.resource.data.actorUid == request.auth.uid
        && request.resource.data.actorUsername is string
        && get(
          /databases/$(database)/documents/userProfiles/$(request.auth.uid)
        ).data.username == request.resource.data.actorUsername
        && request.resource.data.createdAt == request.time
        && request.resource.data.isRead == false;
    }

    function validFollowNotification(notificationId) {
      let followPath = /databases/$(database)/documents/follows/$(request.auth.uid + '_' + request.resource.data.recipientUid);
      return request.resource.data.keys().hasOnly([
          'recipientUid', 'actorUid', 'actorUsername', 'type', 'createdAt', 'isRead'
        ])
        && request.resource.data.keys().hasAll([
          'recipientUid', 'actorUid', 'actorUsername', 'type', 'createdAt', 'isRead'
        ])
        && request.resource.data.type == 'follow'
        && request.resource.data.recipientUid is string
        && request.resource.data.recipientUid != request.auth.uid
        && exists(
          /databases/$(database)/documents/userProfiles/$(request.resource.data.recipientUid)
        )
        && !exists(/databases/$(database)/documents/notifications/$(notificationId))
        && !exists(followPath)
        && existsAfter(followPath)
        && getAfter(followPath).data.followerUid == request.auth.uid
        && getAfter(followPath).data.targetUid == request.resource.data.recipientUid
        && getAfter(followPath).data.eventId == notificationId;
    }

    function validLikeNotification(notificationId, contentType) {
      let collectionName = contentType == 'artwork' ? 'artworks' : 'sprites';
      let contentPath = /databases/$(database)/documents/$(collectionName)/$(request.resource.data.contentId);
      return request.resource.data.keys().hasOnly([
          'recipientUid', 'actorUid', 'actorUsername', 'type', 'contentType',
          'contentId', 'createdAt', 'isRead'
        ])
        && request.resource.data.keys().hasAll([
          'recipientUid', 'actorUid', 'actorUsername', 'type', 'contentType',
          'contentId', 'createdAt', 'isRead'
        ])
        && request.resource.data.type == 'like'
        && request.resource.data.contentType == contentType
        && request.resource.data.contentId is string
        && !exists(/databases/$(database)/documents/notifications/$(notificationId))
        && exists(contentPath)
        && existsAfter(contentPath)
        && get(contentPath).data.artistUid == request.resource.data.recipientUid
        && request.resource.data.recipientUid != request.auth.uid
        && !(request.auth.uid in get(contentPath).data.get('likes', []))
        && request.auth.uid in getAfter(contentPath).data.get('likes', [])
        && getAfter(contentPath).data.get('likeEventIds', {}).get(
          request.auth.uid, ''
        ) == notificationId;
    }

    function validCommentNotification(notificationId, contentType) {
      let collectionName = contentType == 'artwork' ? 'artworks' : 'sprites';
      let contentPath = /databases/$(database)/documents/$(collectionName)/$(request.resource.data.contentId);
      let commentPath = /databases/$(database)/documents/$(collectionName)/$(request.resource.data.contentId)/comments/$(request.resource.data.commentId);
      return request.resource.data.keys().hasOnly([
          'recipientUid', 'actorUid', 'actorUsername', 'type', 'contentType',
          'contentId', 'commentId', 'commentText', 'createdAt', 'isRead'
        ])
        && request.resource.data.keys().hasAll([
          'recipientUid', 'actorUid', 'actorUsername', 'type', 'contentType',
          'contentId', 'commentId', 'commentText', 'createdAt', 'isRead'
        ])
        && request.resource.data.type == 'comment'
        && request.resource.data.contentType == contentType
        && request.resource.data.contentId is string
        && request.resource.data.commentId is string
        && request.resource.data.commentText is string
        && !exists(/databases/$(database)/documents/notifications/$(notificationId))
        && exists(contentPath)
        && existsAfter(contentPath)
        && get(contentPath).data.artistUid == request.resource.data.recipientUid
        && request.resource.data.recipientUid != request.auth.uid
        && !exists(commentPath)
        && existsAfter(commentPath)
        && getAfter(commentPath).data.userUid == request.auth.uid
        && getAfter(commentPath).data.username == request.resource.data.actorUsername
        && getAfter(commentPath).data.text == request.resource.data.commentText
        && notificationId == 'comment_' + contentType + '_'
          + request.resource.data.contentId + '_'
          + request.resource.data.commentId;
    }

    // Artwork documents are public, but only their author can create them.
    match /artworks/{artworkId} {
      allow read: if true;

      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly([
          'title',
          'description',
          'imageUrl',
          'artistUid',
          'artistUsername',
          'tags',
          'createdAt'
        ])
        && request.resource.data.artistUid == request.auth.uid
        // Match the stored username to the authenticated author's public profile.
        && get(
          /databases/$(database)/documents/userProfiles/$(request.auth.uid)
        ).data.username == request.resource.data.artistUsername
        && request.resource.data.title is string
        && request.resource.data.description is string
        && request.resource.data.imageUrl is string
        && request.resource.data.imageUrl.matches(
          '^data:image/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$'
        )
        && request.resource.data.imageUrl.size() <= 136559
        && request.resource.data.artistUsername is string
        && request.resource.data.tags is list
        && request.resource.data.createdAt == request.time;

      allow update: if request.auth != null
        && (
          (resource.data.artistUid == request.auth.uid
            && request.resource.data.artistUid == resource.data.artistUid
            && request.resource.data.artistUsername == resource.data.artistUsername
            // Content edits cannot modify likes; likes use the constrained branch below.
            && !request.resource.data.diff(resource.data).affectedKeys()
              .hasAny(['likes', 'likeEventIds']))
          || (addsOwnLike()
            && (resource.data.artistUid == request.auth.uid
              || (!exists(/databases/$(database)/documents/notifications/$(request.resource.data.get('likeEventIds', {}).get(request.auth.uid, '')))
                && existsAfter(
                /databases/$(database)/documents/notifications/$(request.resource.data.get('likeEventIds', {}).get(request.auth.uid, ''))
              ))))
          || removesOwnLike()
        );

      allow delete: if request.auth != null
        && resource.data.artistUid == request.auth.uid;

      // A comment is a separate document so the parent artwork stays small.
      match /comments/{commentId} {
        allow read: if true;

        allow create: if request.auth != null
          && exists(
            /databases/$(database)/documents/artworks/$(artworkId)
          )
          && request.resource.data.keys().hasOnly([
            'userUid',
            'username',
            'text',
            'createdAt'
          ])
          && request.resource.data.userUid == request.auth.uid
          && request.resource.data.username == get(
            /databases/$(database)/documents/userProfiles/$(request.auth.uid)
          ).data.username
          && request.resource.data.text is string
          && request.resource.data.text.trim().size() > 0
          && request.resource.data.text.size() <= 1000
          && request.resource.data.createdAt == request.time
          && (get(
            /databases/$(database)/documents/artworks/$(artworkId)
          ).data.artistUid == request.auth.uid
            || existsAfter(
              /databases/$(database)/documents/notifications/$("comment_artwork_" + artworkId + "_" + commentId)
            ));

        // A comment author can delete their own comment; comments cannot be edited.
        allow delete: if request.auth != null
          && resource.data.userUid == request.auth.uid;
        allow update: if false;
      }
    }

    // Sprite images are public, but only their authenticated author can add them.
    // Static sprites use PNG/JPEG Data URLs; animated sprites use GIF Data URLs.
    // The 68,300-character limit corresponds to a 50 KiB file after Base64 encoding.
    match /sprites/{spriteId} {
      allow read: if true;

      allow create: if request.auth != null
        && request.resource.data.type is string
        && request.resource.data.artistUid == request.auth.uid
        // The username is copied from the profile, so clients cannot invent it.
        && get(
          /databases/$(database)/documents/userProfiles/$(request.auth.uid)
        ).data.username == request.resource.data.artistUsername
        && request.resource.data.title is string
        && request.resource.data.description is string
        && request.resource.data.artistUsername is string
        && request.resource.data.tags is list
        && request.resource.data.createdAt == request.time
        && (
          (request.resource.data.type == 'static'
            && request.resource.data.keys().hasOnly([
              'type',
              'title',
              'description',
              'artistUid',
              'artistUsername',
              'tags',
              'previewUrl',
              'createdAt'
            ])
            && request.resource.data.previewUrl is string
            && request.resource.data.previewUrl.matches(
              '^data:image/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$'
            )
            && request.resource.data.previewUrl.size() <= 68300)
          ||
          (request.resource.data.type == 'animated'
            && request.resource.data.keys().hasOnly([
              'type',
              'title',
              'description',
              'artistUid',
              'artistUsername',
              'tags',
              'animationUrl',
              'createdAt'
            ])
            && request.resource.data.animationUrl is string
            && request.resource.data.animationUrl.matches(
              '^data:image/gif;base64,[A-Za-z0-9+/]+={0,2}$'
            )
            && request.resource.data.animationUrl.size() <= 68300)
        );

      // Only a constrained operation on the likes array is allowed on a sprite.
      allow update: if (addsOwnLike()
          && (resource.data.artistUid == request.auth.uid
            || (!exists(/databases/$(database)/documents/notifications/$(request.resource.data.get('likeEventIds', {}).get(request.auth.uid, '')))
              && existsAfter(
              /databases/$(database)/documents/notifications/$(request.resource.data.get('likeEventIds', {}).get(request.auth.uid, ''))
            ))))
        || removesOwnLike();
      allow delete: if request.auth != null
        && resource.data.artistUid == request.auth.uid;

      // A comment is a separate document so the parent sprite stays small.
      match /comments/{commentId} {
        allow read: if true;

        allow create: if request.auth != null
          && exists(
            /databases/$(database)/documents/sprites/$(spriteId)
          )
          && request.resource.data.keys().hasOnly([
            'userUid',
            'username',
            'text',
            'createdAt'
          ])
          && request.resource.data.userUid == request.auth.uid
          && request.resource.data.username == get(
            /databases/$(database)/documents/userProfiles/$(request.auth.uid)
          ).data.username
          && request.resource.data.text is string
          && request.resource.data.text.trim().size() > 0
          && request.resource.data.text.size() <= 1000
          && request.resource.data.createdAt == request.time
          && (get(
            /databases/$(database)/documents/sprites/$(spriteId)
          ).data.artistUid == request.auth.uid
            || existsAfter(
              /databases/$(database)/documents/notifications/$("comment_sprite_" + spriteId + "_" + commentId)
            ));

        // A comment author can delete their own comment; comments cannot be edited.
        allow delete: if request.auth != null
          && resource.data.userUid == request.auth.uid;
        allow update: if false;
      }
    }

    // Project previews and original Aseprite bytes are stored in the same document.
    // projectFileData is pure Base64, without a Data URL prefix.
    match /projects/{projectId} {
      allow read: if true;

      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly([
          'title',
          'description',
          'artistUid',
          'artistUsername',
          'tags',
          'previewUrl',
          'projectFileData',
          'fileName',
          'fileSizeBytes',
          'mimeType',
          'createdAt'
        ])
        && request.resource.data.artistUid == request.auth.uid
        && get(
          /databases/$(database)/documents/userProfiles/$(request.auth.uid)
        ).data.username == request.resource.data.artistUsername
        && request.resource.data.title is string
        && request.resource.data.description is string
        && request.resource.data.artistUsername is string
        && request.resource.data.tags is list
        && request.resource.data.previewUrl is string
        && request.resource.data.previewUrl.matches(
          '^data:image/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$'
        )
        && request.resource.data.previewUrl.size() <= 68300
        && request.resource.data.projectFileData is string
        && request.resource.data.projectFileData.matches(
          '^[A-Za-z0-9+/]+={0,2}$'
        )
        && request.resource.data.projectFileData.size() <= 13656
        && request.resource.data.fileName is string
        && request.resource.data.fileName.matches('(?i)^.*[.]aseprite$')
        && request.resource.data.fileSizeBytes is int
        && request.resource.data.fileSizeBytes > 0
        && request.resource.data.fileSizeBytes <= 10240
        && request.resource.data.mimeType == 'application/octet-stream'
        && request.resource.data.createdAt == request.time;

      // Projects cannot be edited; only the owner can remove their own project.
      allow update: if false;
      allow delete: if request.auth != null
        && resource.data.artistUid == request.auth.uid;
    }


    // Usernames are public so the app can look up profiles.
    match /usernames/{username} {
      allow read: if true;

      // Only authenticated users can reserve an unused username.
      allow create: if request.auth != null
        && username.matches('^[a-z0-9_]{3,20}$')
        && request.resource.data.keys().hasOnly(['uid'])
        && request.resource.data.uid == request.auth.uid
        && !exists(
          /databases/$(database)/documents/usernames/$(username)
        );

      // Reserved usernames cannot be overwritten or deleted.
      allow update, delete: if false;
    }

    // Public profiles can be read by everyone.
    match /userProfiles/{uid} {
      allow read: if true;

      // A profile can be created only by its owner,
      // with a matching username reservation.
      allow create: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.uid == uid
        && request.resource.data.usernameLower is string
        && getAfter(
          /databases/$(database)/documents/usernames/$(request.resource.data.usernameLower)
        ).data.uid == uid;

      // Owners cannot change their UID or username.
      allow update: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.uid == resource.data.uid
        && request.resource.data.username == resource.data.username
        && request.resource.data.usernameLower == resource.data.usernameLower;

      allow delete: if false;
    }

    // Follow relationships between authenticated users.
    match /follows/{followId} {
      allow read: if true;

      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly([
          'followerUid',
          'targetUid',
          'eventId'
        ])
        && request.resource.data.followerUid == request.auth.uid
        && request.resource.data.targetUid is string
        && request.resource.data.targetUid != request.auth.uid
        && followId == request.auth.uid + '_' + request.resource.data.targetUid
        && request.resource.data.eventId is string
        && request.resource.data.eventId.size() > 0
        && existsAfter(
          /databases/$(database)/documents/notifications/$(request.resource.data.eventId)
        );

      allow delete: if request.auth != null
        && resource.data.followerUid == request.auth.uid;

      allow update: if false;
    }

    // Notifications are private to their recipient.
    match /notifications/{notificationId} {
      allow read: if request.auth != null
        && resource.data.recipientUid == request.auth.uid;

      // Recipients can only change the read status.
      allow update: if request.auth != null
        && resource.data.recipientUid == request.auth.uid
        && request.resource.data.diff(resource.data)
          .affectedKeys().hasOnly(['isRead'])
        && request.resource.data.isRead == true;

      // Create is allowed only in the same atomic write as a validated social event.
      allow create: if validNotificationActor()
        && (
          validFollowNotification(notificationId)
          || validLikeNotification(notificationId, 'artwork')
          || validLikeNotification(notificationId, 'sprite')
          || validCommentNotification(notificationId, 'artwork')
          || validCommentNotification(notificationId, 'sprite')
        );

      // Notifications are historical records and cannot be deleted by clients.
      allow delete: if false;
    }
  }
}

