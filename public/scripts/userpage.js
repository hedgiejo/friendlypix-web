/**
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

window.friendlyPix = window.friendlyPix || {};

/**
 * Handles the User Profile UI.
 */
friendlyPix.UserPage = class {
  /**
   * Initializes the user's profile UI.
   * @constructor
   */
  constructor() {
    // Firebase SDK.
    this.database = firebase.database();
    this.auth = firebase.auth();

    $(document).ready(() => {
      // DOM Elements.
      this.userPage = $('#page-user-info');
      this.userAvatar = $('.fp-user-avatar');
      this.toast = $('.mdl-js-snackbar');
      this.userUsername = $('.fp-user-username');
      this.userInfoContainer = $('.fp-user-container');
      this.followContainer = $('.fp-follow');
      this.noPosts = $('.fp-no-posts', this.userPage);
      this.followLabel = $('.mdl-switch__label', this.followContainer);
      this.followCheckbox = $('#follow');
      this.blockContainer = $('.fp-block');
      this.blockLabel = $('.mdl-switch__label', this.blockContainer);
      this.blockCheckbox = $('#block');
      this.nbPostsContainer = $('.fp-user-nbposts', this.userPage);
      this.nbFollowers = $('.fp-user-nbfollowers', this.userPage);
      this.nbFollowing = $('.fp-user-nbfollowing', this.userPage);
      this.nbFollowingContainer = $('.fp-user-nbfollowing-container', this.userPage);
      this.followingContainer = $('.fp-user-following', this.userPage);
      this.nextPageButton = $('.fp-next-page-button button');
      this.closeFollowingButton = $('.fp-close-following', this.userPage);
      this.userInfoPageImageContainer = $('.fp-image-container', this.userPage);

      // DOM Elements for Privacy Consent Modal
      this.privacyDialogButton = $('.privacy-dialog-link');
      this.privacyDialog = $('#privacy-dialog');
      this.privacyDialogSave = $('.privacy-save');
      this.allowDataProcessing = $('#allow-data');
      this.allowContent = $('#allow-content');
      this.allowSocial = $('#allow-social');

      this.uploadButton = $('button#add');
      this.mobileUploadButton = $('button#add-floating');

      // Event bindings.
      this.followCheckbox.change(() => this.onFollowChange());
      this.blockCheckbox.change(() => this.onBlockChange());
      this.auth.onAuthStateChanged(() => this.trackFollowStatus());
      this.auth.onAuthStateChanged(() => this.trackBlockStatus());
      this.nbFollowingContainer.click(() => this.displayFollowing());
      this.closeFollowingButton.click(() => {
        this.followingContainer.hide();
        this.nbFollowingContainer.removeClass('is-active');
      });

      // Event bindings for Privacy Consent Dialog
      this.privacyDialogButton.click(() => this.showPrivacyDialog());
      this.privacyDialogSave.click(() => this.savePrivacySettings());
      this.allowDataProcessing.change(() => this.toggleSubmitStates());
    });
  }

  /**
   * Sets initial state of Privacy Dialog.
   */
  showPrivacyDialog() {
    this.initializePrivacySettings();
    // Prevent the escape key from dismissing the dialog
    this.privacyDialog.keydown(function(e) {
      if (e.keyCode == 27) return false;
    });
    this.privacyDialog.get(0).showModal();
  }

  /**
   * Disable the submit button for the privacy settings until data privacy
   * policy is agreed to.
   */
  toggleSubmitStates() {
    if (this.allowDataProcessing.is(':checked')) {
      this.privacyDialogSave.removeAttr('disabled');
    } else {
      this.privacyDialogSave.attr('disabled', true);
    }
  }

  setUploadButtonState(enabled) {
    if (enabled) {
      this.uploadButton.removeAttr('disabled');
      this.mobileUploadButton.removeAttr('disabled');
    } else {
      this.uploadButton.prop('disabled', true);
      this.mobileUploadButton.prop('disabled', true);
    }
  }

  /**
   * Fetches previously saved privacy settings if they exist and
   * enables the Submit button if user has consented to data processing.
   */
  initializePrivacySettings() {
    const uid = firebase.auth().currentUser.uid;
    if (this.savedPrivacySettings === undefined) {
      friendlyPix.firebase.getPrivacySettings(uid).then((snapshot) => {
        this.savedPrivacySettings = snapshot.val();
        if (this.savedPrivacySettings) {
          if (this.savedPrivacySettings.data_processing) {
            this.allowDataProcessing.prop('checked', true);
            this.privacyDialogSave.removeAttr('disabled');
          }
          if (this.savedPrivacySettings.content) {
            this.allowContent.prop('checked', true);
            this.uploadButton.removeAttr('disabled');
            this.mobileUploadButton.removeAttr('disabled');
          }
          if (this.savedPrivacySettings.social) {
            this.allowSocial.prop('checked', true);
          }
        }
      });
    }
  }

  /**
   * Saves new privacy settings and closes the privacy dialog.
   */
  savePrivacySettings() {
    // uid of signed in user
    const uid = firebase.auth().currentUser.uid;
    const settings = {
      data_processing: this.allowDataProcessing.prop('checked'),
      content: this.allowContent.prop('checked'),
      social: this.allowSocial.prop('checked'),
    };

    friendlyPix.firebase.setPrivacySettings(uid, settings);
    if (!settings.social) {
      friendlyPix.firebase.removeFromSearch(uid);
    }
    this.privacyDialog.get(0).close();
    window.friendlyPix.router.reloadPage();
    this.setUploadButtonState(this.allowContent.prop('checked'));
  }

  /**
   * Triggered when the user changes the "Follow" checkbox.
   */
  onFollowChange() {
    const checked = this.followCheckbox.prop('checked');
    this.followCheckbox.prop('disabled', true);

    friendlyPix.firebase.toggleFollowUser(this.userId, checked);
  }

  /**
   * Triggered when the user changes the "Block" checkbox.
   */
  onBlockChange() {
    const checked = this.blockCheckbox.prop('checked');
    this.blockCheckbox.prop('disabled', true);

    friendlyPix.firebase.toggleBlockUser(this.userId, checked);
  }

  /**
   * Starts tracking the "Follow" checkbox status.
   */
  trackFollowStatus() {
    if (this.auth.currentUser) {
      friendlyPix.firebase.registerToFollowStatusUpdate(this.userId, (data) => {
        this.followCheckbox.prop('checked', data.val() !== null);
        this.followCheckbox.prop('disabled', false);
        this.followLabel.text(data.val() ? 'Following' : 'Follow');
        friendlyPix.MaterialUtils.refreshSwitchState(this.followContainer);
      });
    }
  }

  /**
   * Starts tracking the "Blocked" checkbox status.
   */
  trackBlockStatus() {
    if (this.auth.currentUser) {
      friendlyPix.firebase.registerToBlockedStatusUpdate(this.userId, (data) => {
        this.blockCheckbox.prop('checked', data.val() !== null);
        this.blockCheckbox.prop('disabled', false);
        this.blockLabel.text(data.val() ? 'Blocked' : 'Block');
        friendlyPix.MaterialUtils.refreshSwitchState(this.blockContainer);
      });
    }
  }

  /**
   * Adds the list of posts to the UI.
   */
  addPosts(posts) {
    const postIds = Object.keys(posts);
    for (let i = postIds.length - 1; i >= 0; i--) {
      this.userInfoPageImageContainer.append(
          friendlyPix.UserPage.createImageCard(postIds[i],
              posts[postIds[i]].thumb_url || posts[postIds[i]].url, posts[postIds[i]].text));
      this.noPosts.hide();
    }
  }

  /**
   * Shows the "load next page" button and binds it the `nextPage` callback. If `nextPage` is `null`
   * then the button is hidden.
   */
  toggleNextPageButton(nextPage) {
    if (nextPage) {
      this.nextPageButton.show();
      this.nextPageButton.unbind('click');
      this.nextPageButton.prop('disabled', false);
      this.nextPageButton.click(() => {
        this.nextPageButton.prop('disabled', true);
        nextPage().then((data) => {
          this.addPosts(data.entries);
          this.toggleNextPageButton(data.nextPage);
        });
      });
    } else {
      this.nextPageButton.hide();
    }
  }

  /**
   * Displays the given user information in the UI.
   */
  loadUser(userId) {
    // userId for the Userpage, not the user who is signed in.
    this.userId = userId;

    // Reset the UI.
    this.clear();

    // If users is the currently signed-in user we hide the "Follow" checkbox and the opposite for
    // the "Notifications" checkbox.
    if (this.auth.currentUser && userId === this.auth.currentUser.uid) {
      this.followContainer.hide();
      this.blockContainer.hide();
      friendlyPix.messaging.enableNotificationsContainer.show();
      friendlyPix.messaging.enableNotificationsCheckbox.prop('disabled', true);
      friendlyPix.MaterialUtils.refreshSwitchState(friendlyPix.messaging.enableNotificationsContainer);
      friendlyPix.messaging.trackNotificationsEnabledStatus();
    } else {
      friendlyPix.messaging.enableNotificationsContainer.hide();
      this.followContainer.show();
      this.followCheckbox.prop('disabled', true);
      this.blockContainer.show();
      this.blockContainer.prop('disabled', true);
      friendlyPix.MaterialUtils.refreshSwitchState(this.followContainer);
      // Start live tracking the state of the "Follow" Checkbox.
      this.trackFollowStatus();
      // Start live tracking the state of the "Block" Checkbox.
      this.trackBlockStatus();
    }

    // Load user's profile.
    friendlyPix.firebase.loadUserProfile(userId).then((snapshot) => {
      const userInfo = snapshot.val();
      if (userInfo) {
        this.userAvatar.css('background-image',
            `url("${userInfo.profile_picture || '/images/silhouette.jpg'}")`);
        this.userUsername.text(userInfo.full_name || 'Anonymous');
        this.userInfoContainer.show();
      } else {
        let data = {
          message: 'This user does not exists.',
          timeout: 5000,
        };
        this.toast[0].MaterialSnackbar.showSnackbar(data);
        page(`/feed`);
      }
    });

    // Lod user's number of followers.
    friendlyPix.firebase.registerForFollowersCount(userId,
        (nbFollowers) => this.nbFollowers.text(nbFollowers));

    // Lod user's number of followed users.
    friendlyPix.firebase.registerForFollowingCount(userId,
        (nbFollowed) => this.nbFollowing.text(nbFollowed));

    // Lod user's number of posts.
    friendlyPix.firebase.registerForPostsCount(userId,
        (nbPosts) => this.nbPostsContainer.text(nbPosts));

    // Display user's posts.
    friendlyPix.firebase.getUserFeedPosts(userId).then((data) => {
      const postIds = Object.keys(data.entries);
      if (postIds.length === 0) {
        this.noPosts.show();
      }
      friendlyPix.firebase.subscribeToUserFeed(userId,
        (postId, postValue) => {
          this.userInfoPageImageContainer.prepend(
              friendlyPix.UserPage.createImageCard(postId,
                  postValue.thumb_url || postValue.url, postValue.text));
          this.noPosts.hide();
        }, postIds[postIds.length - 1]);

      // Adds fetched posts and next page button if necessary.
      this.addPosts(data.entries);
      this.toggleNextPageButton(data.nextPage);
    });

    // Listen for posts deletions.
    friendlyPix.firebase.registerForPostsDeletion((postId) =>
        $(`.fp-post-${postId}`, this.userPage).remove());
  }

  /**
   * Displays the list of followed people.
   */
  displayFollowing() {
    friendlyPix.firebase.getFollowingProfiles(this.userId).then((profiles) => {
      // Clear previous following list.
      $('.fp-usernamelink', this.followingContainer).remove();
      // Display all following profile cards.
      Object.keys(profiles).forEach((uid) => this.followingContainer.prepend(
          friendlyPix.UserPage.createProfileCardHtml(
              uid, profiles[uid].profile_picture, profiles[uid].full_name)));
      if (Object.keys(profiles).length > 0) {
        this.followingContainer.show();
        // Mark submenu as active.
        this.nbFollowingContainer.addClass('is-active');
      }
    });
  }

  /**
   * Clears the UI and listeners.
   */
  clear() {
    // Removes all pics.
    $('.fp-image', this.userInfoPageImageContainer).remove();

    // Remove active states of sub menu selectors (like "Following").
    $('.is-active', this.userInfoPageImageContainer).removeClass('is-active');

    // Cancel all Firebase listeners.
    friendlyPix.firebase.cancelAllSubscriptions();

    // Hides the "Load Next Page" button.
    this.nextPageButton.hide();

    // Hides the user info box.
    this.userInfoContainer.hide();

    // Hide and empty the list of Followed people.
    this.followingContainer.hide();
    $('.fp-usernamelink', this.followingContainer).remove();

    // Stops then infinite scrolling listeners.
    friendlyPix.MaterialUtils.stopOnEndScrolls();

    // Hide the "No posts" message.
    this.noPosts.hide();
  }

  /**
   * Returns an image Card element for the image with the given URL.
   */
  static createImageCard(postId, thumbUrl, text) {
    const element = $(`
          <a class="fp-image mdl-cell mdl-cell--12-col mdl-cell--4-col-tablet
                    mdl-cell--4-col-desktop mdl-grid mdl-grid--no-spacing">
              <div class="fp-overlay">
                  <i class="material-icons">favorite</i><span class="likes">0</span>
                  <i class="material-icons">mode_comment</i><span class="comments">0</span>
                  <div class="fp-pic-text"/>
              </div>
              <div class="mdl-card mdl-shadow--2dp mdl-cell
                          mdl-cell--12-col mdl-cell--12-col-tablet mdl-cell--12-col-desktop"></div>
          </a>`);
    $('.fp-pic-text', element).text(text);
    element.attr('href', `/post/${postId}`);
    element.addClass(`fp-post-${postId}`);
    // Display the thumbnail.
    $('.mdl-card', element).css('background-image', `url("${thumbUrl.replace(/"/g, '\\"')}")`);
    // Start listening for comments and likes counts.
    friendlyPix.firebase.registerForLikesCount(postId,
        (nbLikes) => $('.likes', element).text(nbLikes));
    friendlyPix.firebase.registerForCommentsCount(postId,
        (nbComments) => $('.comments', element).text(nbComments));

    return element;
  }

  /**
   * Returns an image Card element for the image with the given URL.
   */
  static createProfileCardHtml(uid, profilePic = '/images/silhouette.jpg', fullName = 'Anonymous') {
    fullName = friendlyPix.MaterialUtils.escapeHtml(fullName);
    return `
        <a class="fp-usernamelink mdl-button mdl-js-button" href="/user/${uid}">
            <div class="fp-avatar" style="background-image: url('${profilePic}')"></div>
            <div class="fp-username mdl-color-text--black">${fullName}</div>
        </a>`;
  }
};

friendlyPix.userPage = new friendlyPix.UserPage();
