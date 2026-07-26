import "dotenv/config";

import { prisma } from "./index.js";

async function testDB() {

    const notebook = await prisma.notebook.create({

        data:{

            title:"Promise Notes",

            description:"Learning promises"

        }

    });

    console.log(notebook);

}

testDB()
.catch(console.error)
.finally(async()=>{

    await prisma.$disconnect();

});