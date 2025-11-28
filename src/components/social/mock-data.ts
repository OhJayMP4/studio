import { SocialPost } from "@/lib/types";
import { Timestamp } from "firebase/firestore";

function createTimestamp(day: number, hour: number, minute: number): Timestamp {
    const date = new Date();
    date.setDate(day);
    date.setHours(hour, minute, 0, 0);
    return Timestamp.fromDate(date);
}

export const getMockPosts = (companyId: string): SocialPost[] => [
    {
        id: 'post1',
        companyId: companyId,
        workspaceId: 'workspace1',
        createdByUserId: 'user1',
        scheduledAt: createTimestamp(5, 10, 0),
        platforms: ['facebook', 'instagram'],
        captionDefault: 'Exciting news! Our new product is launching soon. Stay tuned for more details!',
        media: [{ fileUrl: 'https://picsum.photos/seed/post1/400/400', fileType: 'image' }],
        status: 'scheduled',
        createdAt: createTimestamp(1, 9, 0),
        updatedAt: createTimestamp(1, 9, 30),
    },
    {
        id: 'post2',
        companyId: companyId,
        workspaceId: 'workspace1',
        createdByUserId: 'user2',
        scheduledAt: createTimestamp(5, 16, 30),
        platforms: ['linkedin'],
        captionDefault: 'We are hiring! Looking for a talented software engineer to join our team. #hiring #jobs',
        media: [],
        status: 'published',
        createdAt: createTimestamp(2, 11, 0),
        updatedAt: createTimestamp(3, 14, 0),
    },
    {
        id: 'post3',
        companyId: companyId,
        workspaceId: 'workspace1',
        createdByUserId: 'user1',
        scheduledAt: createTimestamp(12, 9, 0),
        platforms: ['x'],
        captionDefault: 'Quick tip: did you know you can use our new feature to save time? #productivity',
        media: [],
        status: 'pending_approval',
        createdAt: createTimestamp(10, 18, 0),
        updatedAt: createTimestamp(10, 18, 0),
    },
    {
        id: 'post4',
        companyId: companyId,
        workspaceId: 'workspace1',
        createdByUserId: 'user1',
        scheduledAt: createTimestamp(21, 18, 0),
        platforms: ['facebook', 'x'],
        captionDefault: 'This post was rejected and needs rework.',
        media: [],
        status: 'rejected',
        rejectionReason: 'Image is low quality and caption has a typo.',
        createdAt: createTimestamp(18, 10, 0),
        updatedAt: createTimestamp(20, 11, 0),
    },
     {
        id: 'post5',
        companyId: companyId,
        workspaceId: 'workspace1',
        createdByUserId: 'user2',
        scheduledAt: createTimestamp(21, 11, 0),
        platforms: ['instagram'],
        captionDefault: 'This is a draft post, still working on it.',
        media: [{ fileUrl: 'https://picsum.photos/seed/post5/400/400', fileType: 'image' }],
        status: 'draft',
        createdAt: createTimestamp(20, 15, 0),
        updatedAt: createTimestamp(20, 15, 0),
    }
];
