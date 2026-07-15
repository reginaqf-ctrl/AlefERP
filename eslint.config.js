const fs = require('node:fs');
const path = require('node:path');

const js = require('@eslint/js');
const globals = require('globals');

const declarationPattern =
  /^(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm;

const appsScriptGlobals = Object.fromEntries(
  [
    'AdsApp',
    'Analytics',
    'BigQuery',
    'Browser',
    'CalendarApp',
    'CardService',
    'Charts',
    'console',
    'ContentService',
    'DataStudioApp',
    'DocumentApp',
    'DriveApp',
    'FormApp',
    'GmailApp',
    'GroupsApp',
    'HtmlService',
    'Jdbc',
    'LanguageApp',
    'LinearOptimizationService',
    'LockService',
    'Logger',
    'MailApp',
    'Maps',
    'MimeType',
    'PropertiesService',
    'ScriptApp',
    'Session',
    'SlidesApp',
    'SpreadsheetApp',
    'UrlFetchApp',
    'Utilities',
    'XmlService',
    'YouTube'
  ].map(name => [name, 'readonly'])
);

const sourceFiles = fs
  .readdirSync(__dirname, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
  .map(entry => entry.name)
  .filter(fileName => fileName !== 'eslint.config.js');

const declarationsByFile = Object.fromEntries(
  sourceFiles.map(fileName => {
    const source = fs.readFileSync(path.join(__dirname, fileName), 'utf8');
    const declarations = new Set();

    for (const match of source.matchAll(declarationPattern)) {
      declarations.add(match[1] || match[2]);
    }

    return [fileName, declarations];
  })
);

const projectGlobalNames = new Set(
  Object.values(declarationsByFile).flatMap(declarations => [...declarations])
);

module.exports = [
  {
    ignores: ['node_modules/**', '.husky/_/**']
  },
  js.configs.recommended,
  {
    files: ['eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node
    }
  },
  ...sourceFiles.map(fileName => {
    const localDeclarations = declarationsByFile[fileName];
    const externalProjectGlobals = Object.fromEntries(
      [...projectGlobalNames]
        .filter(name => !localDeclarations.has(name))
        .map(name => [name, 'readonly'])
    );

    return {
      files: [fileName],
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script',
        globals: {
          ...globals.es2021,
          ...appsScriptGlobals,
          ...externalProjectGlobals
        }
      },
      rules: {
        'no-unused-vars': [
          'warn',
          {
            args: 'after-used',
            argsIgnorePattern: '^_',
            caughtErrors: 'none',
            vars: 'local'
          }
        ],
        'no-useless-assignment': 'off',
        'preserve-caught-error': 'off'
      }
    };
  })
];
