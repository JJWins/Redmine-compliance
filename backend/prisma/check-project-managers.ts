/**
 * Script to check which projects are missing manager_id
 * 
 * Usage:
 *   tsx prisma/check-project-managers.ts
 * 
 * This script will:
 * 1. List all projects missing manager_id
 * 2. Show total count of projects with and without managers
 * 3. Optionally show projects that have manager_id set
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProjectManagers() {
  try {
    // Get all projects
    const allProjects = await prisma.project.findMany({
      select: {
        id: true,
        redmineProjectId: true,
        name: true,
        managerId: true,
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        status: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Separate projects with and without managers
    const projectsWithManager = allProjects.filter(p => p.managerId !== null);
    const projectsWithoutManager = allProjects.filter(p => p.managerId === null);

    console.log('\n=== Project Manager Status Report ===\n');
    console.log(`Total Projects: ${allProjects.length}`);
    console.log(`Projects WITH Manager: ${projectsWithManager.length}`);
    console.log(`Projects WITHOUT Manager: ${projectsWithoutManager.length}`);
    console.log(`Percentage with Manager: ${allProjects.length > 0 ? Math.round((projectsWithManager.length / allProjects.length) * 100) : 0}%\n`);

    if (projectsWithoutManager.length > 0) {
      console.log('=== Projects Missing Manager ===\n');
      projectsWithoutManager.forEach((project, index) => {
        console.log(`${index + 1}. [Redmine ID: ${project.redmineProjectId}] ${project.name} (Status: ${project.status})`);
      });
      console.log('');
    }

    if (projectsWithManager.length > 0) {
      console.log('=== Projects WITH Manager (Sample - First 10) ===\n');
      projectsWithManager.slice(0, 10).forEach((project, index) => {
        console.log(`${index + 1}. [Redmine ID: ${project.redmineProjectId}] ${project.name}`);
        console.log(`   Manager: ${project.manager?.name || 'Unknown'} (${project.manager?.email || 'N/A'})`);
      });
      if (projectsWithManager.length > 10) {
        console.log(`\n... and ${projectsWithManager.length - 10} more projects with managers\n`);
      }
    }

    // Group by status
    console.log('\n=== Breakdown by Status ===\n');
    const byStatus = {
      active: { total: 0, withManager: 0, withoutManager: 0 },
      archived: { total: 0, withManager: 0, withoutManager: 0 },
      closed: { total: 0, withManager: 0, withoutManager: 0 },
    };

    allProjects.forEach(project => {
      const status = project.status as 'active' | 'archived' | 'closed';
      byStatus[status].total++;
      if (project.managerId) {
        byStatus[status].withManager++;
      } else {
        byStatus[status].withoutManager++;
      }
    });

    Object.entries(byStatus).forEach(([status, stats]) => {
      if (stats.total > 0) {
        console.log(`${status.toUpperCase()}:`);
        console.log(`  Total: ${stats.total}`);
        console.log(`  With Manager: ${stats.withManager}`);
        console.log(`  Without Manager: ${stats.withoutManager}`);
        console.log(`  Percentage: ${Math.round((stats.withManager / stats.total) * 100)}%\n`);
      }
    });

  } catch (error: any) {
    console.error('Error checking project managers:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkProjectManagers();

