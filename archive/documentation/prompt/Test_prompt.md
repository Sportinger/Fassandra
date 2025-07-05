Before any shell command you will source helper/bash/cargo_speed.sh
Please check if all parts of the codebase have a proper testsuite established. The frontend has vitest, the backend has cargo test. If not, take action to introduce it.
The backend will have a separate test database, and the backend/env_test file which contains everything that tests are run on this database, not the real database.
Make sure that you only change an existing file if unavoidable, or to mark things there for testing. Do never change existing code which is to be tested, only exception is test code which throws errors.
If not yet existing, add tests for all functions, and all other things which can be tested, in separate files with names which make it easy to understand that they are tests, and what they test.
Make sure that there is always a complete set of tests to test all corner cases or unsual situations for each function, as well for normal usage cases.
Double check for posible additions of tests for any function in the code, and add if you find new possible tests.
Make sure that you do not change things which already exist unless you have a clear reason to improve them.
Make sure there is a central bash file called run_tests.sh, hereby check for an existing file, which you should check for improvements but only change when needed for those, which will do the following:
* If not yet existing provide for a test database and put it into .env.test so that everything can run with the content of .env.test as if it were the real .env file.
* Run all testsuites, no matter if backend or frontend or all other parts where tests are possible and necessary.
* Create three files:
> test_summmary which shows all stats for all testsuites.
> test_errors which lists all tests which had unexpected failures or unexpected passes
> test_coverage_missing which lists all shortcomings of testsuites not covering things they could also test. It will take measured to also include coverage info from cargo test and cargo-tarpaulin

If you find any errors during this, which need fixes before testsuite can be written, do not fix them, but write them down in a separate text file errors_before_test which can be addressed in a separate run.
Now execute the central bash file and make sure it produces meaningful results and no errors.
Make sure that you check backend_test_output.log and frontend_test_output.log for errors. If there are errors, fix them and rerun the run_tests.sh and check again for errors. Iterate in fixing the errors until you can prove that no errors are any more in any test output log file.
Make sure all tests we have anywhere were actually run. Print out the number of run tests, and the number of implemented tests.
Make sure that test_summary contains all appropriate information.
Make sure all things which can be tested and have not been tested are in test_coverage_missing listed.
If there are errors which do not concern the tests' code tell me and ask me how to prodeed, otherwise fix without asking.
If there is coverage gaps proceed in filling them and repeat the whole scenario. Only stop when coverage cannot be improved any more.
Be careful to not repeat your fixing attempts more than three times and to choose another safe option then.
