"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || "";
let initialized = false;

function initMixpanel() {
  if (initialized || typeof window === "undefined") return;
  mixpanel.init(MIXPANEL_TOKEN, {
    autocapture: false,
    persistence: "localStorage",
    cross_subdomain_cookie: false,
    secure_cookie: true,
    cross_site_cookie: false,
    ignore_dnt: false,
    track_pageview: false,
  });
  initialized = true;
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
  if (typeof window === "undefined") return;
  initMixpanel();
  mixpanel.track(event, { ...pageProperties(), ...properties });
}

export default function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPage = useRef<string | null>(null);

  useEffect(() => {
    initMixpanel();
    const pageKey = `${pathname}?${searchParams.toString()}${window.location.hash}`;
    if (lastPage.current === pageKey) return;
    lastPage.current = pageKey;
    mixpanel.track("SV", { ...pageProperties(), event_description: "Site visit / page view" });
  }, [pathname, searchParams]);

  useEffect(() => {
    const trackHashNavigation = () => {
      mixpanel.track("SV", { ...pageProperties(), event_description: "Site visit / page view", navigation_type: "hash" });
    };
    const trackClick = (event: MouseEvent) => {
      const interactive = (event.target as Element | null)?.closest(
        "button, a, [role='button'], input[type='button'], input[type='submit']",
      ) as HTMLElement | null;
      if (!interactive) return;
      mixpanel.track("BTC", { ...elementProperties(interactive), event_description: "Button or link click" });
    };
    const trackSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      const fields = Array.from(form.elements).map((field) => (field as HTMLInputElement).name).filter(Boolean);
      mixpanel.track("Form Submitted", {
        ...pageProperties(),
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
          mixpanel.track(response.ok ? "Form Submission Succeeded" : "Form Submission Failed", {
            ...pageProperties(),
            form_type: requestUrl.includes("/api/quote") ? "quote_request" : "contact_request",
            response_status: response.status,
          });
        }
        return response;
      } catch (error) {
        if (trackedForm) {
          mixpanel.track("Form Submission Failed", {
            ...pageProperties(),
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
          mixpanel.track("Scroll Depth Reached", { ...pageProperties(), scroll_depth_percent: depth });
        }
      });
    };
    const visibleSections = new WeakSet<Element>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || visibleSections.has(entry.target)) return;
        visibleSections.add(entry.target);
        const element = entry.target as HTMLElement;
        mixpanel.track("Section Viewed", {
          ...pageProperties(),
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
