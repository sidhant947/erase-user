import { Devvit, JSONObject, FormOnSubmitEvent, RemovalReason, User } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  http: false
});

async function removeUser(username: string, subredditName: string, context: Devvit.Context, markAsSpam: boolean, timePeriod: string) {
  const getPosts = (context: Devvit.Context, username: string) =>
    context.reddit.getPostsByUser({ username }).all();

  const getComments = (context: Devvit.Context, username: string) =>
    context.reddit.getCommentsByUser({ username }).all();

  const filterBySubredditAndTime = (items: any[], subredditName: string, timePeriod: string) => {
    const now = Date.now();
    const timeFilters = {
      'all time': Infinity
    };
    const timeLimit = timeFilters[timePeriod as keyof typeof timeFilters];

    return items.filter(item =>
      item.subredditName === subredditName &&
      (now - new Date(item.createdAt).getTime()) <= timeLimit
    );
  };

  const removeItems = (context: Devvit.Context, items: any[], markAsSpam: boolean) =>
    items.map(item => context.reddit.remove(item.id, markAsSpam))


  const [allPosts, allComments] = await Promise.all([
    getPosts(context, username),
    getComments(context, username)
  ]);


  const postsToRemove = filterBySubredditAndTime(
    allPosts.map(p => ({ id: p.id, subredditName: p.subredditName, createdAt: p.createdAt })),
    subredditName,
    timePeriod
  );
  const commentsToRemove = filterBySubredditAndTime(
    allComments.map(c => ({ id: c.id, subredditName: c.subredditName, createdAt: c.createdAt })),
    subredditName,
    timePeriod
  );

  await Promise.all([
    ...removeItems(context, postsToRemove, markAsSpam),
    ...removeItems(context, commentsToRemove, markAsSpam)
  ]);
}

Devvit.addMenuItem({
  location: ['post', 'comment'],
  label: 'Erase User',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const { reddit, ui } = context;
    let authorId = null;

    if (event.location === 'post') {
      const post = await reddit.getPostById(event.targetId);
      authorId = post.authorId;
    } else if (event.location === 'comment') {
      const comment = await reddit.getCommentById(event.targetId);
      authorId = comment.authorId;
    }

    const author = await reddit.getUserById(authorId as string);
    const subreddit = await reddit.getCurrentSubreddit();

    try {

      await reddit.banUser({
        subredditName: subreddit.name,
        username: author?.username ?? 'unknown',
        duration: undefined,
        reason: 'Permanent Erase',
      });

      await reddit.muteUser({
        subredditName: subreddit.name,
        username: author?.username ?? 'unknown',
        note: 'Muted by erase-user'
      });

      // Remove all content
      if (author?.username) {
        await removeUser(author.username, subreddit.name, context, true, 'all time');
      } else {
        ui.showToast('Error: Author username is undefined.');
        console.error('Error: Author username is undefined.');
      }

      if (author?.username) {
        ui.showToast(`${author.username} has been erased.`);
      } else {
        ui.showToast('Error: Author username is undefined.');
        console.error('Error: Author username is undefined.');
      }
    } catch (error) {
      ui.showToast(`Error banning user: ${error}`);
      console.error(`Error during instant ban: ${error}`);
    }
  },
});

Devvit.addMenuItem({
  location: ['post', 'comment'],
  label: 'Erase User Content Only',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const { reddit, ui } = context;
    let authorId = null;

    if (event.location === 'post') {
      const post = await reddit.getPostById(event.targetId);
      authorId = post.authorId;
    } else if (event.location === 'comment') {
      const comment = await reddit.getCommentById(event.targetId);
      authorId = comment.authorId;
    }

    const author = await reddit.getUserById(authorId as string);
    const subreddit = await reddit.getCurrentSubreddit();

    try {

      // Remove all content
      if (author?.username) {
        await removeUser(author.username, subreddit.name, context, true, 'all time');
      } else {
        ui.showToast('Error: Author username is undefined.');
        console.error('Error: Author username is undefined.');
      }

      if (author?.username) {
        ui.showToast(`${author.username} posts/comments has been erased.`);
      } else {
        ui.showToast('Error: Author username is undefined.');
        console.error('Error: Author username is undefined.');
      }
    } catch (error) {
      ui.showToast(`Error banning user: ${error}`);
      console.error(`Error during instant ban: ${error}`);
    }
  },
});

export default Devvit;