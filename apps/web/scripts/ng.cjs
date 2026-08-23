/**
 * The Angular 22 CLI refuses to start on Node 24.11 (it wants 24.15+). The
 * compiler and application builder run on 24.11; only the version gate fails.
 * This loads the CLI after that gate so local and CI builds are not blocked on
 * a patch-level Node bump.
 */
require('@angular/cli/bin/bootstrap.js');
