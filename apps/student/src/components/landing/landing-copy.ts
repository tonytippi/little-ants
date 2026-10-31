/**
 * The landing page's words, one language at a time (Vietnamese at /, English at /en).
 * Facts come from the program plan (LA 3-6 Program Plan v2.0); voice from the brand guide: warm, short, no promises.
 */

export type Lang = 'vi' | 'en';

/** Social pages: an icon shows only once its link is filled in. */
export const SOCIAL_LINKS: { name: 'Facebook' | 'Zalo'; href: string }[] = [
  { name: 'Facebook', href: '' },
  { name: 'Zalo', href: '' },
];

interface Level {
  name: string;
  age: string;
  skills: string;
  themes: string;
  tone: 'leaf' | 'sun' | 'ant';
}

export interface LandingCopy {
  title: string;
  description: string;
  hero: { eyebrow: string; headline: string; sub: string; signIn: string; tv: string; picture: string };
  levels: { heading: string; intro: string; themesLabel: string; items: Level[] };
  learning: { heading: string; items: { title: string; text: string }[] };
  listening: { heading: string; text: string; points: string[]; picture: string };
  start: { heading: string; steps: string[]; signIn: string };
  footer: { follow: string };
}

export const LANDING_COPY: Record<Lang, LandingCopy> = {
  vi: {
    title: 'Little Ants English · Tiếng Anh cho bé 3–6 tuổi',
    description:
      'Bé học tiếng Anh qua bài hát, câu chuyện và trò chơi vận động cùng 14 người bạn ở Đồi Kiến. Ở lớp có cô, ở nhà có Listening Time, mỗi ngày vài phút.',
    hero: {
      eyebrow: 'Tiếng Anh cho bé 3–6 tuổi',
      headline: 'Little steps, big English!',
      sub: 'Bé học tiếng Anh qua bài hát, câu chuyện và trò chơi vận động cùng 14 người bạn ở Đồi Kiến. Ở lớp có cô, ở nhà có Listening Time, mỗi ngày vài phút.',
      signIn: 'Đăng nhập',
      tv: 'Xem trên TV',
      picture: 'Mười bốn người bạn ở Đồi Kiến đứng thành hàng',
    },
    levels: {
      heading: 'Ba cấp độ, ba năm học',
      intro:
        '12 chủ đề gần gũi, mỗi năm 4 chủ đề, lớn dần cùng bé từ mẫu giáo bé đến khi sẵn sàng vào lớp 1.',
      themesLabel: 'Chủ đề',
      items: [
        {
          name: 'Little Ants',
          age: '3–4 tuổi',
          skills: 'Nghe, làm theo, hát và nhận biết những âm đầu tiên.',
          themes: 'bạn bè, gia đình, cơ thể, trường lớp, nông trại.',
          tone: 'leaf',
        },
        {
          name: 'Busy Ants',
          age: '4–5 tuổi',
          skills: 'Hỏi và trả lời, tả đồ vật, tô chữ cái.',
          themes: 'khu vườn, món ăn, ngôi nhà, xe cộ.',
          tone: 'sun',
        },
        {
          name: 'Big Ants',
          age: '5–6 tuổi',
          skills: 'Kể chuyện, ghép âm đọc từ, đọc sách nhỏ và viết câu đầu tiên.',
          themes: 'thời tiết, nghề nghiệp, Việt Nam, bé lớn rồi.',
          tone: 'ant',
        },
      ],
    },
    learning: {
      heading: 'Học bằng cả cơ thể',
      items: [
        {
          title: 'Bài hát & vận động',
          text: 'Mỗi chủ đề có bài hát và vè quen thuộc, bé vừa hát vừa làm động tác.',
        },
        {
          title: 'Truyện tranh',
          text: 'Những câu chuyện ngắn có tranh vẽ sáp màu ấm áp, bé nghe, chỉ tranh rồi kể lại.',
        },
        {
          title: 'Âm và chữ',
          text: 'Mỗi tuần làm quen vài âm mới, từ nghe âm đầu đến ghép âm đọc từ.',
        },
      ],
    },
    listening: {
      heading: 'Listening Time ở nhà',
      text: 'Mỗi ngày bé nghe lại bài hát, câu chuyện và âm đã học ở lớp, chỉ vài phút. Mỗi lần nghe xong, một chiếc lá trên con đường của bé chuyển xanh.',
      points: [
        'Theo đúng bài bé đang học ở lớp.',
        'Tải về máy để nghe không cần mạng.',
        'Nút to, ít chữ, bé tự bấm được.',
      ],
      picture: 'Bà Kiến, Annie và Tiny với giỏ trái cây trong vườn',
    },
    start: {
      heading: 'Bắt đầu thế nào',
      steps: [
        'Nhà trường đăng ký email của phụ huynh.',
        'Bấm Đăng nhập và chọn tài khoản Google của email đó.',
        'Thêm vào màn hình chính để mở như một ứng dụng.',
      ],
      signIn: 'Đăng nhập',
    },
    footer: { follow: 'Theo dõi chúng tôi' },
  },
  en: {
    title: 'Little Ants English · English for children aged 3–6',
    description:
      'Children learn English through songs, stories and play with 14 friends from the Ant Hill. With their teacher at school, and with Listening Time at home, a few minutes a day.',
    hero: {
      eyebrow: 'English for children aged 3–6',
      headline: 'Little steps, big English!',
      sub: 'Children learn English through songs, stories and play with 14 friends from the Ant Hill. With their teacher at school, and with Listening Time at home, a few minutes a day.',
      signIn: 'Sign in',
      tv: 'Watch on TV',
      picture: 'The fourteen Ant Hill friends standing in a row',
    },
    levels: {
      heading: 'Three levels, three school years',
      intro: '12 friendly themes, four a year, growing with your child from nursery to Grade 1.',
      themesLabel: 'Themes',
      items: [
        {
          name: 'Little Ants',
          age: 'ages 3–4',
          skills: 'Listening, actions, songs and first sounds.',
          themes: 'friends, family, body, school, the farm.',
          tone: 'leaf',
        },
        {
          name: 'Busy Ants',
          age: 'ages 4–5',
          skills: 'Questions and answers, describing, tracing letters.',
          themes: 'the garden, food, home, things that go.',
          tone: 'sun',
        },
        {
          name: 'Big Ants',
          age: 'ages 5–6',
          skills: 'Telling stories, blending sounds, reading little books and writing a first sentence.',
          themes: 'weather, helpers, Vietnam, growing up.',
          tone: 'ant',
        },
      ],
    },
    learning: {
      heading: 'Learning with the whole body',
      items: [
        {
          title: 'Songs & moves',
          text: 'Every theme has songs and chants with actions to sing and move along.',
        },
        {
          title: 'Storybooks',
          text: 'Short stories with warm crayon pictures to listen to, point at and retell.',
        },
        {
          title: 'Sounds and letters',
          text: 'A few new sounds each week, from hearing first sounds to blending words.',
        },
      ],
    },
    listening: {
      heading: 'Listening Time at home',
      text: 'Every day your child listens again to the songs, stories and sounds from class, just a few minutes. Each listening turns a leaf on their path green.',
      points: [
        'Follows what your child is learning in class.',
        'Download to listen without internet.',
        'Big buttons and few words, so children can use it alone.',
      ],
      picture: 'Grandma Ant, Annie and Tiny with a basket of fruit in the garden',
    },
    start: {
      heading: 'How to start',
      steps: [
        'The school registers your email address.',
        'Press Sign in and choose the Google account for that email.',
        'Add it to your home screen to open it like an app.',
      ],
      signIn: 'Sign in',
    },
    footer: { follow: 'Follow us' },
  },
};
