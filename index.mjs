#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { Octokit } from '@octokit/rest';
import prompts from 'prompts';
import dotenv from 'dotenv';

dotenv.config();

const repo = process.env.PIAR_REPO;
const owner = process.env.PIAR_REPO;

const typeOfPR = [
  { title: '🍕 Feature', value: 'feature' },
  { title: '🐛 Hotfix', value: 'hotfix' },
  { title: '📝 Readme update', value: 'readme' },
  { title: '🎨 Style', value: 'style' },
  { title: '🧑‍💻 Code Refactor', value: 'refactor' },
  { title: '🔥 Performance Improvements', value: 'perf' },
  { title: '✅ Test', value: 'test' },
  { title: '🤖 Build', value: 'build' },
  { title: '🔁 CI', value: 'ci' },
  { title: '📦 Chore (Release)', value: 'chore' },
  { title: '⏩ Revert', value: 'revert' },
];

const checkListItem = (check) => {
  return check ? 'x' : ' ';
};

const createPullRequestBody = ({
  type,
  description,
  ticket,
  tests,
  documentation,
  postDeployment,
}) => {
  return `
# What type of PR is this? (check all applicable)
- [${checkListItem(type.includes('feature'))}] 🍕 Feature
- [${checkListItem(type.includes('hotfix'))}] 🐛 Hotfix
- [${checkListItem(type.includes('readme'))}] 📝 Readme update
- [${checkListItem(type.includes('style'))}] 🎨 Style
- [${checkListItem(type.includes('refactor'))}] 🧑‍💻 Code Refactor
- [${checkListItem(type.includes('perf'))}] 🔥 Performance Improvements
- [${checkListItem(type.includes('test'))}] ✅ Test
- [${checkListItem(type.includes('build'))}] 🤖 Build
- [${checkListItem(type.includes('ci'))}] 🔁 CI
- [${checkListItem(type.includes('chore'))}] 📦 Chore (Release)
- [${checkListItem(type.includes('revert'))}] ⏩ Revert

## Description

${description}

## Related Tickets & Documents

${
  ticket
    ? `[${ticket}](https://rankmi.myjetbrains.com/youtrack/issue/${ticket})`
    : ''
}

## Mobile & Desktop Screenshots/Recordings

Add images or videos

## Added tests?

- [${checkListItem(tests)}] 👍 yes
- [${checkListItem(tests === null)}] 🙅 no, because they aren't needed
- [${checkListItem(!tests)}] 🙋 no, because I need help

## Added to documentation?

- [${documentation === 'readme' ? 'x' : ' '}] 📜 README.md
- [${documentation === 'notion' ? 'x' : ' '}] 📓 notion docs
- [${documentation === 'nodoc' ? 'x' : ' '}] 🙅 no documentation needed

## [optional] Are there any post-deployment tasks we need to perform?
${postDeployment}
`;
};

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const runCommand = (command) => {
  try {
    const res = execSync(command);
    return res;
  } catch (error) {
    console.error(`Error executing command ${command}`);
    console.error(error);
    process.exit(1);
  }
};

const getLocalBranches = () => {
  const branches = runCommand('git branch');

  return branches
    .toString()
    .split(/\r?\n|\r|\n/g)
    .map((text) => text.trim())
    .filter(Boolean);
};

const getCurrentBranch = () => {
  return getLocalBranches()
    .find((branch) => branch.startsWith('*'))
    .replace('*', '')
    .trim();
};

const getBaseBranches = () => {
  return getLocalBranches().filter((branch) => !branch.startsWith('*'));
};

const getBranchType = (branch) => {
  return branch.split('/')[0];
};

const getInitialPRType = (selectedType) => {
  return typeOfPR.findIndex((type) => type.value === selectedType);
};

const run = async () => {
  const questions = [
    {
      type: 'toggle',
      name: 'draft',
      message: 'is Draft?',
      initial: false,
      active: 'yes',
      inactive: 'no',
    },
    {
      type: 'autocomplete',
      name: 'base',
      message: 'Choose you base branch',
      choices: getBaseBranches().map((branch) => ({
        title: branch,
        value: branch,
      })),
      max: 1,
    },
    {
      type: 'autocomplete',
      name: 'compare',
      message: 'Choose you compare branch',
      choices: [getCurrentBranch(), ...getBaseBranches()].map((branch) => ({
        title: branch,
        value: branch,
      })),
      initial: getCurrentBranch(),
    },
    {
      type: 'multiselect',
      name: 'type',
      message: 'What type of PR is this? (check all applicable)',
      choices: typeOfPR,
      initial: getInitialPRType(getBranchType(getCurrentBranch())),
    },
    {
      type: 'text',
      name: 'description',
      message: 'Description',
    },
    {
      type: 'text',
      name: 'ticket',
      message: 'Related Tickets & Documents',
    },
    {
      type: 'select',
      name: 'tests',
      message: 'Added tests?',
      choices: [
        { title: '👍 yes', value: true },
        { title: '🙋 no, because I need help', value: false },
        { title: '🙅 no, because they are not needed', value: null },
      ],
      initial: 2,
    },
    {
      type: 'select',
      name: 'documentation',
      message: 'Added to documentation?',
      choices: [
        { title: '📜 README.md', value: 'readme' },
        { title: '📓 notion docs', value: 'notion' },
        {
          title: '🙅 no documentation needed',
          value: 'nodoc',
        },
      ],
      initial: 2,
    },
    {
      type: 'text',
      name: 'postDeployment',
      message:
        '[optional] Are there any post-deployment tasks we need to perform?',
    },
  ];
  const template = await prompts(questions);
  const pr = await octokit.rest.pulls.create({
    owner,
    repo,
    base: template.base,
    head: `${owner}:${template.compare}`,
    draft: template.draft,
    title: template.ticket
      ? `[${template.ticket}] ${template.description}`
      : template.description,
    body: createPullRequestBody(template),
  });
  console.log(pr.data.html_url);
};

run();
