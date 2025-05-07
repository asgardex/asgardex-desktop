import path from 'path'

import * as TE from 'fp-ts/lib/TaskEither'
import * as fs from 'fs-extra'

import { INVALID_PATH_SEGMENT, VALID_SEGMENT_PATTERN } from '../../shared/const'

/**
 * Reads a file.
 *
 * Borrowed from https://github.com/gcanti/fp-ts-node/blob/master/src/fs.ts
 * Note: `fp-ts-node` is not available on npm
 */
export const readFile: (path: string, encoding: string) => TE.TaskEither<Error, string> = TE.taskify<
  string,
  string,
  Error,
  string
>(fs.readFile)

/**
 * Reads a JSON file.
 */
export const readJSON: (path: string, options?: fs.ReadOptions) => TE.TaskEither<Error, unknown> = TE.taskify<
  string,
  fs.ReadOptions | undefined,
  Error,
  unknown
>(fs.readJSON)

/**
 * Reads a directory
 */
export const readDir: (path: fs.PathLike) => TE.TaskEither<NodeJS.ErrnoException, string[]> = TE.taskify<
  fs.PathLike,
  NodeJS.ErrnoException,
  string[]
>(fs.readdir)

/**
 * Writes a file.
 * If the parent directory does not exist, it will be created.
 *
 * Borrowed from https://github.com/gcanti/fp-ts-node/blob/master/src/fs.ts
 * Note: `fp-ts-node` is not available on npm (issue https://github.com/gcanti/fp-ts-node/issues/10)
 */
export const writeFile: (path: string, data: string, options?: fs.WriteFileOptions) => TE.TaskEither<Error, void> =
  TE.taskify<string, string, fs.WriteFileOptions | undefined, Error, void>(fs.outputFile)

/**
 * Writes a JSON file.
 * If the parent directory does not exist, it will be created.
 */
export const writeJSON: (
  path: string,
  data: boolean | number | string | object | null,
  options?: fs.WriteOptions
) => TE.TaskEither<Error, void> = TE.taskify<
  string,
  boolean | number | string | object | null,
  fs.WriteOptions | undefined,
  Error,
  void
>(fs.outputJSON)

export const exists: (path: string) => TE.TaskEither<Error, boolean> = TE.taskify<string, Error, boolean>(fs.pathExists)

/**
 * Renames a file
 */
export const renameFile: (oldPath: fs.PathLike, newPath: fs.PathLike) => TE.TaskEither<Error, void> = TE.taskify<
  fs.PathLike,
  fs.PathLike,
  Error,
  void
>(fs.rename)

/**
 * Sanitizes a segment of a file path to prevent path traversal vulnerabilities.
 * Disallows slashes, backslashes, "..", and other potentially dangerous patterns.
 * Optionally, you can enforce an alphanumeric+safe symbols whitelist.
 *
 * @param segment - The dynamic portion of the path (e.g., file name or version).
 * @param label - A label used in error messages for context (e.g., "file name").
 * @returns The validated and safe segment string.
 * @throws If the segment contains potentially dangerous characters or patterns.
 */
export const sanitizePathSegment = (segment: string, label: string): string => {
  if (INVALID_PATH_SEGMENT.test(segment) || !VALID_SEGMENT_PATTERN.test(segment)) {
    throw new Error(`Invalid path segment for ${label}: "${segment}"`)
  }
  return segment
}

/**
 * Builds a safe file path for storing JSON config or state files.
 * Each input is validated to prevent path traversal and injection risks.
 *
 * @param baseDir - The base directory to store the file in.
 * @param name - A sanitized identifier for the file name prefix.
 * @param version - A sanitized version identifier.
 * @returns The fully constructed and safe file path.
 */
export const buildJsonFilePath = (baseDir: string, name: string, version: string): string => {
  const safeName = sanitizePathSegment(name, 'file name')
  const safeVersion = sanitizePathSegment(version, 'version')

  /* trunk-ignore(semgrep/javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal) */
  return path.join(baseDir, `${safeName}-${safeVersion}.json`)
}
