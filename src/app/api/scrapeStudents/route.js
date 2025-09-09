// app/api/puppeteer-stream/route.js
import puppeteer from 'puppeteer';

export async function POST(request) {
  const { user, pass, studentList, classList } = await request.json();
  
  // Create a ReadableStream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      let browser;
      let page;
      
      const sendUpdate = (data) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(new TextEncoder().encode(message));
      };
      
      const delay = (time) => {
        return new Promise(function(resolve) { 
            setTimeout(resolve, time)
        });
     }

      try {
        sendUpdate({ status: "Initializing browser...", progress: 5 });
        
        // Launch Puppeteer browser
        browser = await puppeteer.launch({
          headless: false,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ]
        });
        
        sendUpdate({ status: "Browser launched, creating page...", progress: 10 });
        
        // Create a new page
        page = await browser.newPage();
        
        sendUpdate({ status: "Loading login page...", progress: 20 });
        
        // Navigate to the URL
        await page.goto("https://myportal.calpoly.edu", {
          waitUntil: 'networkidle0',
          timeout: 30000
        });
        
        sendUpdate({ status: "Page loaded, entering credentials...", progress: 40 });
        
        // Login process
        await page.type('#username', user);
        await page.type('#password', pass);
        
        sendUpdate({ status: "Submitting login form...", progress: 50 });
        
        await page.click('button'); 
        await delay(5000)
        
        const duoCode = await page.evaluate(() => {
            const element = document.querySelector('.verification-code')
            return element ? element.textContent : null
        })

        sendUpdate({ status: duoCode, progress: 70})

        await delay(10000)
        await page.click('button')
        await delay(10000)


        await page.goto("https://dashboards.calpoly.edu/dw/polydata/student_poly_profile_self_svc.display") 
        
        const htmlContent = await page.content();
        sendUpdate({ status: htmlContent, progress: 70})



        // Process each student
        const results = [];
        for (let i = 0; i < studentList.length; i++) {
          const student = studentList[i];
          const progressPercent = 60 + ((i + 1) / studentList.length) * 30;
          
          sendUpdate({ 
            status: `Processing student ${i + 1}/${studentList.length}: ${student}`, 
            progress: progressPercent 
          });

          let studentInformation = {}
          
          // Your student processing logic here
          // Example: navigate to student page, extract data, etc.
          const studentInfo = await page.evaluate(() => {
            const section = document.querySelector('.sectionContent');
            if (!section) return null;
            
            // Get name from h3
            const nameElement = section.querySelector('h3');
            const name = nameElement ? nameElement.textContent.trim() : null;
            
            // Get email and empl ID from list items
            const listItems = section.querySelectorAll('li');
            let email = null;
            let emplId = null;
            
            listItems.forEach(li => {
              const text = li.textContent;
              if (text.includes('Email Address:')) {
                const emailLink = li.querySelector('a[href^="mailto:"]');
                email = emailLink ? emailLink.textContent.trim() : null;
              }
              if (text.includes('Empl ID:')) {
                emplId = text.replace('Empl ID:', '').trim();
              }
            });
            
            return { name, email, emplId };
          });

          const {name, email, emplId} = studentInfo;
          studentInfo.name = name;
          studentInfo.email = email;
          studentInfo.emplId = emplId

          const ftf = await page.evaluate(() => {
            return document.body.textContent.toLowerCase().includes('first-time freshman');
          });

          studentInfo.ftf = ftf

          const eapData = await page.evaluate(() => {
            const table = document.querySelector('#eapInfo tbody');
            if (!table) return null;
            
            const rows = Array.from(table.querySelectorAll('tr'));
            
            return {
              expectedAcademicProgress: rows[0]?.querySelector('td:nth-child(2) span')?.textContent?.trim(),
              actualAcademicProgress: rows[1]?.querySelector('td:nth-child(2) span')?.textContent?.trim(),
              academicProgressStatus: rows[2]?.querySelector('td:nth-child(2) strong')?.textContent?.trim(),
              academicStanding: rows[3]?.querySelector('td:nth-child(2) strong')?.textContent?.trim(),
              estimatedMajorGPA: parseFloat(rows[4]?.querySelector('td:nth-child(2) strong')?.textContent?.trim()) || null
            };
          });
          const {expectedAcademicProgress, actualAcademicProgress, academicProgressStatus, academicStanding, estimatedMajorGPA} = eapData;
          studentInfo.eap = expectedAcademicProgress;
          studentInfo.aap = actualAcademicProgress;
          studentInfo.aps = academicProgressStatus;
          studentInfo.academicStanding = academicStanding;
          studentInfo.estimatedMajorGPA = estimatedMajorGPA;

          const gpaData = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table tbody tr'));
            const result = {
              quarters: [],
              cumulative: {}
            };
            
            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 6) {
                const link = cells[0].querySelector('a');
                
                if (link && link.href.includes('#UGRD-')) {
                  const quarterCode = link.href.split('#UGRD-')[1];
                  const quarterData = {
                    code: quarterCode,                                    // "2228"
                    term: link.textContent.trim(),                       // "Fall Quarter 2022"
                    gpa: parseFloat(cells[5].textContent.trim()) || 0,   // 3.575
                    units: parseFloat(cells[2].textContent.trim()) || 0,  // 16.00
                    gradePoints: parseFloat(cells[4].textContent.trim()) || 0, // 57.20
                    deansList: cells[8] && cells[8].textContent.trim() === 'Y'
                  };
                  result.quarters.push(quarterData);
                }
                else if (cells[0].textContent.includes('CPSLO Cumulative:')) {
                  result.cumulative.cpslo = parseFloat(cells[5].textContent.trim()) || 0; // 3.818
                }
              }
            });
            
            return result;
          });
          
          studentInfo.quarterGPAData = gpaData

          const classes = await page.evaluate(() => {
            const allClasses = [];
            
            // Find all tables within sectionContent
            const tables = document.querySelectorAll('.sectionContent table tbody');
            
            tables.forEach((table, tableIndex) => {
              // Get quarter info from the parent section
              const section = table.closest('.sectionContent');
              const quarterAnchor = section?.querySelector('a[name^="UGRD-"]');
              const quarterCode = quarterAnchor ? quarterAnchor.name.replace('UGRD-', '') : null;
              const quarterName = section?.querySelector('h3')?.textContent?.trim() || 'Unknown Quarter';
              
              const rows = Array.from(table.querySelectorAll('tr'));
              
              rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                
                // Check if this is a class row (has subject code and at least 7 cells)
                if (cells.length >= 7) {
                  const subject = cells[0]?.textContent?.trim();
                  
                  // Skip total rows and other non-class rows
                  if (subject && 
                      !subject.includes('Total:') && 
                      !subject.includes('Dean\'s List') &&
                      !subject.includes('**')) {
                    
                    const classInfo = {
                      subject: subject,
                      title: cells[1]?.textContent?.trim(),
                      unitsAttempted: parseFloat(cells[2]?.textContent?.trim()) || 0,
                      unitsEarned: parseFloat(cells[3]?.textContent?.trim()) || 0,
                      unitsGraded: parseFloat(cells[4]?.textContent?.trim()) || 0,
                      grade: cells[5]?.textContent?.trim(),
                      gradePoints: parseFloat(cells[6]?.textContent?.trim()) || 0,
                      // Extract course info
                      courseCode: subject.split('-')[0] || '',
                      courseNumber: subject.split('-')[1] || '',
                      section: subject.split('-')[2] || ''
                    };
                    
                    if(quarterCode) allClasses.push(classInfo);
                  }
                }
              });
            });
            
            return allClasses;
          });

          studentInfo.classes = classes;
          console.log(studentInfo)

          results.push({
            student: student,
            data: "Sample extracted data"
          });
          
          await page.waitForTimeout(1000); // Simulate processing time
        }
        
        sendUpdate({ status: "Generating final report...", progress: 95 });
        
        const finalResults = {
          success: true,
          results: results,
          totalStudents: studentList.length
        };
        
        sendUpdate({ 
          status: "Complete!", 
          progress: 100, 
          finalResults: finalResults 
        });
        
      } catch (error) {
        console.error('Puppeteer error:', error);
        sendUpdate({ 
          status: "Error occurred", 
          progress: 100, 
          error: error.message 
        });
      } finally {
        if (page) await page.close();
        if (browser) await browser.close();
        controller.close();
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}