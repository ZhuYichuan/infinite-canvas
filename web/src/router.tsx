import { createBrowserRouter, Outlet } from "react-router-dom";

import { AnalyticsTracker } from "@/components/layout/analytics-tracker";
import UserLayout from "@/layouts/user-layout";
import AssetsPage from "@/pages/assets";
import CanvasPage from "@/pages/canvas";
import CanvasProjectPage from "@/pages/canvas/project";
import CommunityPage from "@/pages/community";
import CommunityStudioPage from "@/pages/community/studio";
import ConfigPage from "@/pages/config";
import GuidePage from "@/pages/guide";
import HomePage from "@/pages/home";
import ImagePage from "@/pages/image";
import NotFound from "@/pages/not-found";
import PricingPage from "@/pages/pricing";
import PromptsPage from "@/pages/prompts";
import VideoPage from "@/pages/video";
import WorkflowsPage from "@/pages/workflows";

export const router = createBrowserRouter([
    {
        element: (
            <UserLayout>
                <AnalyticsTracker />
                <Outlet />
            </UserLayout>
        ),
        children: [
            { path: "/", element: <HomePage /> },
            { path: "/image", element: <ImagePage /> },
            { path: "/video", element: <VideoPage /> },
            { path: "/workflows", element: <WorkflowsPage /> },
            { path: "/community", element: <CommunityPage /> },
            { path: "/community/studio", element: <CommunityStudioPage /> },
            { path: "/assets", element: <AssetsPage /> },
            { path: "/prompts", element: <PromptsPage /> },
            { path: "/canvas", element: <CanvasPage /> },
            { path: "/canvas/:id", element: <CanvasProjectPage /> },
            { path: "/config", element: <ConfigPage /> },
            { path: "/guide", element: <GuidePage /> },
            { path: "/pricing", element: <PricingPage /> },
        ],
    },
    { path: "*", element: <NotFound /> },
]);
