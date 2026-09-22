***************************************************************************************
Getting this project and tester up and running:
1) npm install
2) at the root, ng build assessment-ctrl --configuration production; ng build assessment-ctrl-tester
3) ng serve
4) create a debug launch definition
5) F5 to run your new debug launch definition
6) You should now be presented with the tester page

AFTER YOU MAKE ANY CODE CHANGE TO THE TESTER PROJECT:
1) ng serve

AFTER YOU MAKE ANY CODE CHANGE TO THE CONTROL:
1) ng build
2) ng serve
***************************************************************************************
Deploy process to projects that use this control (not the assessment-ctrl-tester project) after making a change to the assessment control code

1) build the control:   npm run buildandpackagectrl

2) copy the generated control tgz (i.e. zip) file to the consuming application (for portal and axis projects that would be the controls folder)

3) in the consuming application, locate the package.json file and copy the line for the assessment control. You will need this shortly for the new install of the control.
	in the portal project, this line is:  "assessment-ctrl": "file:./controls/assessment-ctrl-0.0.1.tgz"

4) in the consuming application, uninstall the assessment control:    npm uninstall assessment-ctrl

5) in the consuming application, locate the package.json file and paste in the assessment control jar dependency that you copied in step 3.
	in the portal project, this line:  "assessment-ctrl": "file:./controls/assessment-ctrl-0.0.1.tgz"

6) in the consuming application, run: npm install

7) in the consuming application, verify in the node_modules folder that the assessment-ctrl project is present

8) in the consuming application, run: npm build     ( or npm build --prod )

9) in the consuming application, copy the contents of the dist folder and deploy to your location that will serve the consuming application (i.e. to the external tomcat instance webapps/<your app> folder)

10) clear your browser file cache (ctrl-H in Chrome) to clear the cached files for the assessment control

11) start up the consuming application and test your changes
***************************************************************************************