"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || "";
type MixpanelInstance = typeof import("mixpanel-browser").default;
let mpInstance: MixpanelInstance | null = null;
const trackQueue: Array<{ event: string; properties: Record<string, unknown> }> = [];
let isImporting = false;

function loadMixpanel(callback?: (mp: MixpanelInstance) => void) {
  if (typeof window === "undefined" || !MIXPANEL_TOKEN) return;
  if (mpInstance) {
    callback?.(mpInstance);
    return;
  }
  if (!isImporting) {
    isImporting = true;
    import("mixpanel-browser")
      .then((mod) => {
        const mp = (mod.default || mod) as MixpanelInstance;
        mp.init(MIXPANEL_TOKEN, {
          autocapture: false,
          persistence: "localStorage",
          cross_subdomain_cookie: false,
          secure_cookie: true,
          cross_site_cookie: false,
          ignore_dnt: false,
          track_pageview: false,
        });
        mpInstance = mp;
        while (trackQueue.length > 0) {
          const item = trackQueue.shift();
          if (item) mp.track(item.event, item.properties);
        }
        callback?.(mp);
      })
      .catch((err) => {
        console.error("Mixpanel dynamic load error:", err);
      })
      .finally(() => {
        isImporting = false;
      });
  }
}

function safeTrack(event: string, properties: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const merged = { ...pageProperties(), ...properties };
  if (mpInstance) {
    mpInstance.track(event, merged);
  } else {
    trackQueue.push({ event, properties: merged });
    loadMixpanel();
  }
}

function pageProperties() {
  const url = new URL(window.location.href);
  return {
    page_path: url.pathname,
    page_url: url.href,
    page_title: document.title,
    page_hash: url.hash || undefined,
    query_string: url.search || undefined,
    referrer: document.referrer || undefined,
    referrer_host: document.referrer ? new URL(document.referrer).hostname : undefined,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    utm_source: url.searchParams.get("utm_source") || undefined,
    utm_medium: url.searchParams.get("utm_medium") || undefined,
    utm_campaign: url.searchParams.get("utm_campaign") || undefined,
    utm_term: url.searchParams.get("utm_term") || undefined,
    utm_content: url.searchParams.get("utm_content") || undefined,
  };
}

function cleanText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim().slice(0, 120) || undefined;
}

function elementProperties(element: HTMLElement) {
  const link = element instanceof HTMLAnchorElement ? element : null;
  const section = element.closest("section, [id]") as HTMLElement | null;
  const jobTitle = element.closest("article")?.querySelector("h3")?.textContent;
  return {
    ...pageProperties(),
    element_type: element.tagName.toLowerCase(),
    element_text: cleanText(element.getAttribute("aria-label") || element.textContent),
    element_id: element.id || undefined,
    element_name: element.getAttribute("name") || undefined,
    section_id: section?.id || undefined,
    destination_url: link?.href || undefined,
    destination_host: link?.href ? new URL(link.href).hostname : undefined,
    link_target: link?.target || undefined,
    is_external: link ? link.hostname !== window.location.hostname : undefined,
    career_role: cleanText(jobTitle),
  };
}

export function trackEvent(event: string, properties: Record<string, unknown> = {}) {
  safeTrack(event, properties);
}

export default function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPage = useRef<string | null>(null);

  useEffect(() => {
    // Schedule mixpanel load during idle time
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => loadMixpanel());
    } else {
      setTimeout(() => loadMixpanel(), 1500);
    }
  }, []);

  useEffect(() => {
    const pageKey = `${pathname}?${searchParams.toString()}${window.location.hash}`;
    if (lastPage.current === pageKey) return;
    lastPage.current = pageKey;
    safeTrack("SV", { event_description: "Site visit / page view" });
  }, [pathname, searchParams]);

  useEffect(() => {
    const trackHashNavigation = () => {
      safeTrack("SV", { event_description: "Site visit / page view", navigation_type: "hash" });
    };
    const trackClick = (event: MouseEvent) => {
      const interactive = (event.target as Element | null)?.closest(
        "button, a, [role='button'], input[type='button'], input[type='submit']",
      ) as HTMLElement | null;
      if (!interactive) return;
      safeTrack("BTC", { ...elementProperties(interactive), event_description: "Button or link click" });
    };
    const trackSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      const fields = Array.from(form.elements).map((field) => (field as HTMLInputElement).name).filter(Boolean);
      safeTrack("Form Submitted", {
        form_id: form.id || undefined,
        form_section: form.closest("[id]")?.id || undefined,
        form_type: fields.includes("projectDescription") ? "quote_request" : "contact_request",
        field_names: fields,
        field_count: fields.length,
      });
    };
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const requestUrl = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
      const trackedForm = requestUrl.includes("/api/contact") || requestUrl.includes("/api/quote");
      try {
        const response = await originalFetch(...args);
        if (trackedForm) {
          safeTrack(response.ok ? "Form Submission Succeeded" : "Form Submission Failed", {
            form_type: requestUrl.includes("/api/quote") ? "quote_request" : "contact_request",
            response_status: response.status,
          });
        }
        return response;
      } catch (error) {
        if (trackedForm) {
          safeTrack("Form Submission Failed", {
            form_type: requestUrl.includes("/api/quote") ? "quote_request" : "contact_request",
            failure_type: "network_error",
          });
        }
        throw error;
      }
    };
    const reached = new Set<number>();
    const trackScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const percentage = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      [25, 50, 75, 90, 100].forEach((depth) => {
        if (percentage >= depth && !reached.has(depth)) {
          reached.add(depth);
          safeTrack("Scroll Depth Reached", { scroll_depth_percent: depth });
        }
      });
    };
    const visibleSections = new WeakSet<Element>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || visibleSections.has(entry.target)) return;
        visibleSections.add(entry.target);
        const element = entry.target as HTMLElement;
        safeTrack("Section Viewed", {
          section_id: element.id,
          section_heading: cleanText(element.querySelector("h1, h2, h3")?.textContent),
        });
      });
    }, { threshold: 0.35 });

    document.querySelectorAll("section, main > [id]").forEach((section) => observer.observe(section));
    window.addEventListener("hashchange", trackHashNavigation);
    document.addEventListener("click", trackClick, true);
    document.addEventListener("submit", trackSubmit, true);
    window.addEventListener("scroll", trackScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", trackHashNavigation);
      document.removeEventListener("click", trackClick, true);
      document.removeEventListener("submit", trackSubmit, true);
      window.removeEventListener("scroll", trackScroll);
      window.fetch = originalFetch;
    };
  }, [pathname, searchParams]);

  return null;
}
