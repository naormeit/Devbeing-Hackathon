import fetch from "node-fetch";

export async function fetchGithubTasks(githubToken, username) {
  const headers = { Authorization: `token ${githubToken}` };

  const [issuesRes, prsRes] = await Promise.all([
    fetch(`https://api.github.com/issues?filter=assigned`, { headers }),
    fetch(`https://api.github.com/search/issues?q=author:${username}+type:pr+state:open`, { headers })
  ]);

  const issues = await issuesRes.json();
  const prsData = await prsRes.json();
  const prs = prsData.items || [];

  const formatted = [
    ...issues.map((i) => ({
      source: "GitHub",
      title: i.title,
      url: i.html_url,
      priority: "high",
    })),
    ...prs.map((p) => ({
      source: "GitHub",
      title: `PR: ${p.title}`,
      url: p.html_url,
      priority: "medium",
    })),
  ];

  return formatted;
}
