#!/usr/bin/env node
import { execSync } from "node:child_process";
import { Octokit } from "@octokit/rest";
import prompts from "prompts";
import dotenv from "dotenv";
import { cosmiconfig } from "cosmiconfig";

dotenv.config();

// TODO: below variables may be stored in piar.config.js file
const repo = process.env.PIAR_REPO;
const owner = process.env.PIAR_OWNER;
// TODO: githubToken variable can be stored in .env
const githubToken = process.env.PIAR_GITHUB_TOKEN;
const explorer = cosmiconfig("piar");
const settings = await explorer.search();

const isAvailable = (key) => {
  return process.env[key];
};

const octokit = new Octokit({
  auth: githubToken,
});

const runCommand = (command) => {
  try {
    const res = execSync(command);
    return res;
  } catch (error) {
    console.error(`Error executing command ${command}`);
    process.exit(1);
  }
};

const getRemoteBranches = () => {
  const branches = runCommand("git branch -r");
  if (!branches.toString()) {
    console.error("Branches not found");
    process.exit(1);
  }

  return branches
    .toString()
    .split(/\r?\n|\r|\n/g)
    .map((text) => text.trim())
    .filter(Boolean)
    .filter((branch) => !branch.includes("upstream/"))
    .map((branch) => branch.replace("origin/", ""));
};

const getCurrentBranch = () => {
  return getRemoteBranches()
    .find((branch) => branch.includes("HEAD"))
    .split("->")[1]
    .trim();
};

const getBaseBranches = () => {
  return getRemoteBranches().filter((branch) => !branch.includes("HEAD"));
};

const run = async () => {
  if (!isAvailable("PIAR_REPO")) {
    console.error("PIAR_REPO variable not found");
    process.exit(1);
  }

  if (!isAvailable("PIAR_OWNER")) {
    console.error("PIAR_OWNER variable not found");
    process.exit(1);
  }

  if (!isAvailable("PIAR_GITHUB_TOKEN")) {
    console.error("PIAR_GITHUB_TOKEN variable not found");
    process.exit(1);
  }

  if (!settings) {
    console.error("config file not found");
    process.exit(1);
  }

  const branchPrompt = [
    {
      type: "toggle",
      name: "draft",
      message: "is Draft?",
      initial: false,
      active: "yes",
      inactive: "no",
    },
    {
      type: "autocomplete",
      name: "base",
      message: "Choose you base branch",
      choices: getBaseBranches().map((branch) => ({
        title: branch,
        value: branch,
      })),
      max: 1,
    },
    {
      type: "autocomplete",
      name: "compare",
      message: "Choose you compare branch",
      choices: getBaseBranches().map((branch) => ({
        title: branch,
        value: branch,
      })),
      initial: getCurrentBranch(),
    },
  ];

  const questions = [...branchPrompt, ...settings.config.questions];
  const template = await prompts(questions);
  const pr = await octokit.rest.pulls.create({
    owner,
    repo,
    base: template.base,
    head: `${owner}:${template.compare}`,
    draft: template.draft,
    title: settings.config.title(template),
    body: settings.config.body(template),
  });
  console.log(pr.data.html_url);
};

run();
